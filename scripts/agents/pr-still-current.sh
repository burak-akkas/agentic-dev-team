#!/usr/bin/env bash
# Checks that a queued Reviewer/QA run still has something worth doing.
# Runs wait on the per-PR concurrency group, so by the time one starts the PR may have
# moved on: new commits, a merge-gate verdict, or a conflict with a just-merged PR.
# Spending a review or a QA round on that state wastes time and usage.
#
# Usage: pr-still-current.sh <pr> <expected-head-sha> [required-label]
# Prints "skip=<reason>" (for $GITHUB_OUTPUT) when the run should stop, nothing otherwise.
# A conflicting PR that nobody flagged yet is sent to the Implementor here.
set -euo pipefail

pr="$1"
sha="$2"
required="${3:-}"
repo="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY must be set}"
here="$(dirname "$0")"

view=$(gh pr view "$pr" -R "$repo" --json state,isDraft,headRefOid,baseRefName,labels)
state=$(echo "$view" | jq -r .state)
head=$(echo "$view" | jq -r .headRefOid)
base=$(echo "$view" | jq -r .baseRefName)
labels=$(echo "$view" | jq -r '[.labels[].name] | join(",")')

if [ "$state" != "OPEN" ]; then
  echo "skip=PR is $state"; exit 0
fi
if [ "$(echo "$view" | jq -r .isDraft)" = "true" ]; then
  echo "skip=PR is a draft"; exit 0
fi
if [ "$head" != "$sha" ]; then
  echo "skip=newer commit ${head:0:7} was pushed, its own run handles it"; exit 0
fi
case ",$labels," in
  *",agent:changes-requested,"*|*",agent:needs-decision,"*|*",agent:needs-human,"*)
    echo "skip=PR is already labeled $labels"; exit 0 ;;
esac
if [ -n "$required" ] && [[ ",$labels," != *",$required,"* ]]; then
  echo "skip=PR no longer has $required (labels: ${labels:-none})"; exit 0
fi

# GitHub computes mergeability lazily; UNKNOWN means "not yet", so retry and proceed if it stays unknown.
mergeable=UNKNOWN
for _ in 1 2 3 4 5; do
  mergeable=$(gh pr view "$pr" -R "$repo" --json mergeable --jq .mergeable)
  [ "$mergeable" != "UNKNOWN" ] && break
  sleep 10
done
if [ "$mergeable" = "CONFLICTING" ]; then
  "$here/transition.sh" "$pr" agent:changes-requested >/dev/null
  gh pr comment "$pr" -R "$repo" --body "<!-- agent:merge -->
⚠️ This PR **conflicts** with \`$base\`, so review and QA are paused. Implementor: run \`git fetch origin $base\` and \`git merge origin/$base\`, resolve the conflicts keeping the intent of both changes, run all checks, and push." >/dev/null
  "$here/progress.sh" --pr "$pr" "🚦 **Conflict**: #$pr conflicts with \`$base\`, back to the Implementor" >/dev/null
  echo "skip=PR conflicts with $base, sent to the Implementor"
fi
