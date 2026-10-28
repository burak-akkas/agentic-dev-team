#!/usr/bin/env bash
# Moves an issue or PR to a new agent state.
# Removes every other `agent:*` label, then adds the new one (if given).
#
# Usage: transition.sh <issue-or-pr-number> [new-label]
#   transition.sh 42 agent:analyzed   # set state
#   transition.sh 42                  # clear all agent:* state labels
set -euo pipefail

n="$1"
new="${2:-}"
repo="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY must be set}"

for label in $(gh api "repos/$repo/issues/$n/labels" --jq '.[].name | select(startswith("agent:"))'); do
  [ "$label" = "$new" ] && continue
  encoded=$(jq -rn --arg l "$label" '$l | @uri')
  gh api -X DELETE "repos/$repo/issues/$n/labels/$encoded" >/dev/null
done

if [ -n "$new" ]; then
  gh api -X POST "repos/$repo/issues/$n/labels" -f "labels[]=$new" >/dev/null
fi

echo "#$n -> ${new:-<cleared>}"
