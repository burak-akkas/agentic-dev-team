#!/usr/bin/env bash
# The Integrator's work on one PR from the merge queue (agent-integrator.yml runs it for each queued
# PR in turn, so only one PR is being merged at any time):
#   1. Checks the PR is still what the agents approved: the approved commit, or GitHub's clean merge
#      of the base on top of it (clean-base-update.sh). Anything else goes back to review.
#   2. If the base branch moved on, merges it in (update-branch) and records the result as approved:
#      the PR's own changes are unchanged. With AGENT_QA_ON_BASE_UPDATE, the queue waits while QA
#      tests the combined code.
#   3. Waits for the required checks on that exact commit.
#   4. If the base moved meanwhile (a human merged something), goes back to 2. Otherwise squash-merges
#      exactly that commit, so what lands on the base is what CI tested.
# Conflicts and red checks go to the Implementor, timeouts and failed merges to the back of the queue.
# Red checks, timeouts and failed merges count as failed attempts: after AGENT_INTEGRATOR_MAX_ATTEMPTS
# (default 3) since the last Lead decision, the Lead decides. Conflicts don't count: they come from
# other PRs' merges, not from this one.
#
# Usage: integrate.sh <pr>
# Logs to stderr. The last stdout line is "result=<merged|bounced|requeued|left|lead>":
#   merged   merged into the base
#   bounced  sent to the Implementor (conflict or red checks)
#   requeued back of the queue (timeout, failed merge, unexpected error)
#   left     no longer in the queue (closed, draft, new commits, label removed, QA did not pass)
#   lead     handed to the Lead after too many failed attempts
# Needs GH_TOKEN, GITHUB_REPOSITORY and AGENT_BOT_ID. Optional: AGENT_REQUIRED_CHECKS (default CI),
# AGENT_QA_ON_BASE_UPDATE (true: QA after each update), AGENT_INTEGRATOR_MAX_ATTEMPTS (3),
# AGENT_INTEGRATOR_CHECKS_MINUTES (30), AGENT_INTEGRATOR_QA_MINUTES (60).
set -Eeuo pipefail

pr="$1"
repo="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY must be set}"
bot="${AGENT_BOT_ID:?AGENT_BOT_ID must be set}"
here="$(dirname "$0")"
required="${AGENT_REQUIRED_CHECKS:-CI}"
qa_on_update="${AGENT_QA_ON_BASE_UPDATE:-}"
max_attempts="${AGENT_INTEGRATOR_MAX_ATTEMPTS:-3}"
checks_minutes="${AGENT_INTEGRATOR_CHECKS_MINUTES:-30}"
qa_minutes="${AGENT_INTEGRATOR_QA_MINUTES:-60}"
run_url="${GITHUB_SERVER_URL:-https://github.com}/$repo/actions/runs/${GITHUB_RUN_ID:-}"
base=""

log()      { echo "#$pr: $*" >&2; }
finish()   { log "result: $1"; echo "result=$1"; exit 0; }
say()      { gh pr comment "$pr" -R "$repo" --body "$1" >/dev/null; }
progress() { "$here/progress.sh" --pr "$pr" "$1"; }
pr_json()  { gh pr view "$pr" -R "$repo" --json "$1"; }
behind()   { gh api "repos/$repo/compare/$1...$base" --jq .ahead_by; }   # base commits missing from <sha>

# Failed attempts (`<!-- agent:integration-failed -->` comments) since the latest Lead decision.
failures() {
  gh api --paginate --slurp "repos/$repo/issues/$pr/comments" | jq --argjson bot "$bot" '[.[][] | select(.user.id == $bot)] as $c
    | ([$c | to_entries[] | select(.value.body | contains("<!-- agent:lead -->")) | .key] | max // -1) as $last
    | [$c | to_entries[] | select(.key > $last and (.value.body | contains("<!-- agent:integration-failed -->")))] | length'
}

# Before treating anything as a failure: the PR may have been merged after all (e.g. an API error
# right after the merge) or closed. Then it is done, not failed. Returns if the PR is still open.
settle_if_closed() {
  local s
  s=$(pr_json state | jq -r .state) || return 0
  case "$s" in
    MERGED)
      "$here/transition.sh" "$pr" agent:done >/dev/null || true
      if [ -n "${issue:-}" ]; then "$here/transition.sh" "$issue" agent:done >/dev/null || true; fi
      finish merged ;;
    CLOSED)
      "$here/transition.sh" "$pr" >/dev/null || true
      finish left ;;
  esac
}

# A failed attempt. fail bounce "<what failed>" "<instructions for the Implementor>"
#                   fail requeue "<what failed>"
fail() {
  local kind="$1" reason="$2" todo="${3:-}" used
  settle_if_closed
  used=$(( $(failures || echo 0) + 1 ))
  if [ "$used" -ge "$max_attempts" ]; then
    "$here/transition.sh" "$pr" agent:needs-decision >/dev/null
    say "<!-- agent:integration-failed -->
🛑 **Merge queue:** $reason. That's $used failed merge attempts since the last Lead decision, so #$pr leaves the queue. Lead, please decide."
    progress "🚦 **Merge queue**: #$pr failed $used merge attempts, handed to the Lead"
    finish lead
  fi
  if [ "$kind" = bounce ]; then
    "$here/transition.sh" "$pr" agent:changes-requested >/dev/null
    say "<!-- agent:merge -->
<!-- agent:integration-failed -->
❌ **Merge queue:** $reason. #$pr leaves the queue (failed attempt $used of $max_attempts). Implementor: $todo"
    progress "🚦 **Merge queue**: $reason on #$pr, back to the Implementor"
    finish bounced
  fi
  # A new admission marker puts it at the back of the queue. Re-applying agent:queued starts the
  # Integrator run that picks it up (the current run handles each PR only once).
  say "<!-- agent:queued -->
<!-- agent:integration-failed -->
⏳ **Merge queue:** $reason. #$pr goes to the back of the queue (failed attempt $used of $max_attempts)."
  "$here/transition.sh" "$pr" agent:queued >/dev/null
  progress "🚦 **Merge queue**: $reason on #$pr, back of the queue"
  finish requeued
}

# A conflict with the base: the Implementor resolves it. Not a failed attempt.
conflict() {
  "$here/transition.sh" "$pr" agent:changes-requested >/dev/null
  say "<!-- agent:merge -->
⚠️ **Merge queue:** $1, so #$pr leaves the queue. Implementor: run \`git fetch origin $base\` and \`git merge origin/$base\`, resolve the conflicts keeping the intent of both changes, run all checks, and push. Where you can, leave this PR's own edits as they were: then the re-review only has to look at the resolution."
  progress "🚦 **Merge queue**: #$pr conflicts with \`$base\`, back to the Implementor"
  finish bounced
}

# Any unexpected error: don't leave the PR stuck in agent:integrating. set -E makes command
# substitutions inherit this trap: there it only fails the substitution, so the error reaches the
# main shell, which handles it once (instead of carrying on with the handler's output as a value).
on_error() {
  if [ "$BASHPID" != "$$" ]; then exit 1; fi
  trap - ERR
  set +e
  log "unexpected error at line $1"
  fail requeue "the Integrator hit an unexpected error ([run log]($run_url))"
}
trap 'on_error $LINENO' ERR

# Records a commit as approved: the Integrator only creates commits that leave the PR's own changes
# as they were, and the merge gate and later Integrator runs only accept approved commits.
approve_commit() {   # <sha> <message>
  say "<!-- agent:integrator -->
$2

<!-- agent:approved-sha $1 -->"
}

# True while the PR is open, not a draft, at <sha> and still carries <label>: nobody else changed it.
still_ours() {   # <sha> <label>
  local v
  v=$(pr_json state,isDraft,headRefOid,labels) || return 1
  [ "$(jq -r .state <<<"$v")" = OPEN ] && [ "$(jq -r .isDraft <<<"$v")" != true ] && [ "$(jq -r .headRefOid <<<"$v")" = "$1" ] \
    && jq -e --arg l "$2" 'any(.labels[]; .name == $l)' <<<"$v" >/dev/null
}

# Drafts are how humans pause the agents: a PR that became one leaves the queue (not a failure).
# Finishes if the PR is an open draft, returns otherwise.
leave_if_draft() {
  [ "$(pr_json state,isDraft | jq -r '.state + " " + (.isDraft | tostring)')" = "OPEN true" ] || return 0
  "$here/transition.sh" "$pr" >/dev/null
  say "⏸️ **Merge queue:** #$pr is a draft now, so it leaves the queue. Mark it ready for review to send it through review and back into the queue."
  finish left
}

# GitHub computes mergeability lazily; UNKNOWN means "not yet".
mergeable() {
  local m=UNKNOWN
  for _ in 1 2 3 4 5 6; do
    m=$(pr_json mergeable | jq -r .mergeable)
    [ "$m" != UNKNOWN ] && break
    sleep 10
  done
  echo "$m"
}

# Waits for the required checks (AGENT_REQUIRED_CHECKS, workflow names) on <sha>, the same rules as QA.
# Sets CHECKS to pass, fail (FAILED lists them), timeout, or moved (the PR changed meanwhile).
wait_checks() {   # <sha>
  local sha="$1" json checks pending deadline
  local filter='[.[] | select(.workflow as $w | ($req | split(",") | map(gsub("^ +| +$"; ""))) | index($w))]'
  deadline=$(( $(date +%s) + checks_minutes * 60 ))
  CHECKS=timeout
  FAILED=
  while [ "$(date +%s)" -lt "$deadline" ]; do
    if ! still_ours "$sha" agent:integrating; then CHECKS=moved; return 0; fi
    json=$(gh pr checks "$pr" -R "$repo" --json workflow,name,bucket,link 2>/dev/null || true)
    checks=$(jq --arg req "$required" "$filter" <<<"${json:-[]}")
    FAILED=$(jq -r '[.[] | select(.bucket == "fail" or .bucket == "cancel") | "[\(.name)](\(.link))"] | join(", ")' <<<"$checks")
    pending=$(jq '[.[] | select(.bucket == "pending")] | length' <<<"$checks")
    if [ -n "$FAILED" ]; then CHECKS=fail; return 0; fi
    if [ "$(jq length <<<"$checks")" -gt 0 ] && [ "$pending" -eq 0 ]; then CHECKS=pass; return 0; fi
    sleep 30
  done
}

# AGENT_QA_ON_BASE_UPDATE: QA tests the updated branch while the queue waits. QA's pass goes through
# the merge gate, which sees the hold marker and hands the PR back here as agent:integrating.
# Returns when that happened, finishes otherwise.
hold_for_qa() {   # <sha>
  local sha="$1" deadline v labels
  say "<!-- agent:integrator-hold $sha -->
🧪 **Merge queue:** QA tests the combined code (\`AGENT_QA_ON_BASE_UPDATE\`). The queue waits for its verdict."
  "$here/transition.sh" "$pr" agent:qa >/dev/null
  progress "🚦 **Merge queue**: QA tests #$pr on the updated branch, the queue waits"
  deadline=$(( $(date +%s) + qa_minutes * 60 ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    sleep 30
    v=$(pr_json state,headRefOid,labels)
    if [ "$(jq -r .state <<<"$v")" != OPEN ] || [ "$(jq -r .headRefOid <<<"$v")" != "$sha" ]; then
      log "changed while QA was testing"; finish left
    fi
    labels=",$(jq -r '[.labels[].name] | join(",")' <<<"$v"),"
    case "$labels" in
      *",agent:integrating,"*) return 0 ;;   # QA passed, the merge gate handed it back
      *",agent:changes-requested,"*|*",agent:needs-decision,"*|*",agent:needs-human,"*|*",agent:review,"*)
        log "QA did not pass (labels: $labels)"; finish left ;;
    esac                                     # agent:qa, agent:approved or between labels: still going
  done
  say "⏳ **Merge queue:** QA didn't finish within $qa_minutes minutes, so the queue moves on. #$pr rejoins it when QA passes."
  finish left
}

# --- Is it still in the queue? ---
v=$(pr_json state,isDraft,headRefOid,baseRefName,labels,closingIssuesReferences)
state=$(jq -r .state <<<"$v")
head=$(jq -r .headRefOid <<<"$v")
base=$(jq -r .baseRefName <<<"$v")
issue=$(jq -r '.closingIssuesReferences[0].number // empty' <<<"$v")
labels=",$(jq -r '[.labels[].name] | join(",")' <<<"$v"),"

if [ "$state" = MERGED ]; then
  "$here/transition.sh" "$pr" agent:done >/dev/null
  finish left
fi
[ "$state" = OPEN ] || finish left
case "$labels" in *",agent:queued,"*|*",agent:integrating,"*) ;; *) log "no longer queued"; finish left ;; esac
leave_if_draft

"$here/transition.sh" "$pr" agent:integrating >/dev/null
log "integrating ${head:0:7} into $base"

# --- 1. Still exactly what was approved? ---
approved=$("$here/approved-sha.sh" "$pr")
if [ "$head" != "$approved" ]; then
  if [ -n "$approved" ] && "$here/clean-base-update.sh" "$pr" "$head" >/dev/null; then
    approve_commit "$head" "🔄 **Merge queue:** \`${head:0:7}\` is GitHub's clean merge of \`$base\` into the approved \`${approved:0:7}\`, so #$pr's own changes are as approved."
  else
    "$here/transition.sh" "$pr" agent:review >/dev/null
    say "🔁 **Merge queue:** $([ -n "$approved" ] && echo "the agents approved \`${approved:0:7}\`, but the head is now \`${head:0:7}\`" || echo "no recorded approval for \`${head:0:7}\`"). Sending it through review again."
    progress "🚦 **Merge queue**: head of #$pr moved after approval, back to review"
    finish left
  fi
fi

# --- 2.-4. Update, test, merge. Repeats only if the base moves outside the queue. ---
for _ in 1 2 3; do
  if ! still_ours "$head" agent:integrating; then leave_if_draft; log "the PR changed or left the queue"; finish left; fi
  if [ "$(mergeable)" = CONFLICTING ]; then
    conflict "#$pr conflicts with \`$base\`"
  fi
  n_behind=$(behind "$head")
  updated=""
  if [ "$n_behind" -gt 0 ]; then
    log "behind $base by $n_behind, updating"
    if ! gh api -X PUT "repos/$repo/pulls/$pr/update-branch" -f expected_head_sha="$head" >/dev/null 2>&1; then
      conflict "\`$base\` can't be merged into #$pr automatically (merge conflicts, or \`$base\` changed workflow files)"
    fi
    new="$head"
    for _ in $(seq 1 30); do
      sleep 4
      new=$(pr_json headRefOid | jq -r .headRefOid)
      [ "$new" != "$head" ] && break
    done
    [ "$new" != "$head" ] || fail requeue "updating the branch didn't produce a new commit in time"
    if ! "$here/clean-base-update.sh" "$pr" "$new" >/dev/null; then
      # Not our merge commit: someone pushed at the same moment.
      "$here/transition.sh" "$pr" agent:review >/dev/null
      say "🔁 **Merge queue:** #$pr got new commits while it was being updated. Sending it through review again."
      finish left
    fi
    approve_commit "$new" "🔄 **Merge queue:** merged \`$base\` ($n_behind new commit(s)) into #$pr. Its own changes are unchanged, so it isn't reviewed again. $([ "$qa_on_update" = true ] && echo "QA and CI test" || echo "CI tests") the combined code before it merges."
    head="$new"
    updated=" (the combined code with the latest \`$base\`)"
    progress "🚦 **Merge queue**: brought #$pr up to date with \`$base\`, testing the combined code"
    if [ "$qa_on_update" = true ]; then hold_for_qa "$head"; fi
  fi

  wait_checks "$head"
  case "$CHECKS" in
    moved)   leave_if_draft; log "the PR changed while its checks ran"; finish left ;;
    fail)    fail bounce "required checks failed on \`${head:0:7}\`$updated: $FAILED" \
               "open the failing check and reproduce it locally. If it only fails together with the latest \`$base\`, run \`git fetch origin $base\` and \`git merge origin/$base\` first. Fix it, run all checks, and push." ;;
    timeout) fail requeue "the required checks ($required) didn't finish within $checks_minutes minutes" ;;
  esac

  # Merge only if nothing landed on the base since the checks started: then the tested code is
  # exactly what lands. Inside the queue nothing else merges; this catches merges by humans.
  if [ "$(behind "$head")" -gt 0 ]; then log "$base moved while the checks ran, updating again"; continue; fi
  # gh can report an error after the merge itself succeeded (e.g. deleting the branch failed), so
  # the PR's state decides, not the exit code.
  err=$(gh pr merge "$pr" -R "$repo" --squash --delete-branch --match-head-commit "$head" 2>&1) || true
  if [ "$(pr_json state | jq -r .state)" = MERGED ]; then
    "$here/transition.sh" "$pr" agent:done >/dev/null
    if [ -n "$issue" ]; then
      "$here/transition.sh" "$issue" agent:done >/dev/null
      prod="https://${GITHUB_REPOSITORY_OWNER:-${repo%%/*}}.github.io/${repo#*/}/"
      "$here/progress.sh" "$issue" "✅ **Merged** #$pr, deploying to [production]($prod)"
    fi
    "$here/sweep-conflicts.sh" "$pr" "$base" >&2
    finish merged
  fi
  log "merge failed: $err"
  # New commits (merge refused by --match-head-commit) or a closed PR: not a failed attempt. The push
  # takes the PR out of the queue and through review (pr-still-current.sh).
  if ! still_ours "$head" agent:integrating; then leave_if_draft; log "the PR changed while merging"; finish left; fi
  if [ "$(behind "$head")" -gt 0 ]; then continue; fi
  fail requeue "the merge failed: $(printf '%s' "$err" | tail -1)"
done
fail requeue "\`$base\` kept moving while #$pr was being tested"
