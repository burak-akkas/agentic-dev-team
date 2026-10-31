#!/usr/bin/env bash
# After a merge, sends the open agent PRs that now conflict with the base branch to the Implementor.
# GitHub runs no pull_request workflows (CI, preview) for conflicting PRs, so they would stall.
# Queued PRs are included: the Implementor can resolve the conflict while the queue moves on,
# instead of when the PR reaches the front.
# Skips PRs that already wait for the Implementor, the Lead or a human, and the PR the Integrator
# is merging right now.
#
# Usage: sweep-conflicts.sh <merged-pr> <base-branch>
# Needs GH_TOKEN, GITHUB_REPOSITORY. Never fails the caller.
set -uo pipefail

merged="$1"
base="$2"
repo="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY must be set}"
here="$(dirname "$0")"

sleep 20   # give GitHub time to recompute mergeability after the merge
for n in $(gh pr list -R "$repo" --state open --base "$base" --json number,headRefName \
             --jq '.[] | select(.headRefName | startswith("agent/")) | .number'); do
  state=UNKNOWN
  for _ in 1 2 3 4 5; do
    state=$(gh pr view "$n" -R "$repo" --json mergeable --jq .mergeable)
    [ "$state" != "UNKNOWN" ] && break
    sleep 10
  done
  echo "PR #$n: $state"
  [ "$state" = "CONFLICTING" ] || continue
  labels=$(gh pr view "$n" -R "$repo" --json labels --jq '[.labels[].name] | join(",")')
  case ",$labels," in
    *",agent:changes-requested,"*|*",agent:needs-decision,"*|*",agent:needs-human,"*|*",agent:integrating,"*) continue ;;
  esac
  "$here/transition.sh" "$n" agent:changes-requested >/dev/null
  gh pr comment "$n" -R "$repo" --body "<!-- agent:merge -->
⚠️ #$merged was just merged into \`$base\`, and this PR now **conflicts** with it.$([[ ",$labels," == *",agent:queued,"* ]] && echo " It leaves the merge queue until that's resolved.") Implementor: run \`git fetch origin $base\` and \`git merge origin/$base\`, resolve the conflicts keeping the intent of both changes, run all checks, and push." >/dev/null
  "$here/progress.sh" --pr "$n" "🚦 **Merge queue**: #$n conflicts with the just-merged #$merged, back to the Implementor"
done
exit 0
