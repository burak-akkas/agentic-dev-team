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

# The new label is removed too if already present: re-adding it fires a fresh `labeled`
# event, so repeating a state (e.g. a second approval) still triggers the next workflow.
for label in $(gh api "repos/$repo/issues/$n/labels" --jq '.[].name | select(startswith("agent:"))'); do
  encoded=$(jq -rn --arg l "$label" '$l | @uri')
  gh api -X DELETE "repos/$repo/issues/$n/labels/$encoded" >/dev/null
done

if [ -n "$new" ]; then
  gh api -X POST "repos/$repo/issues/$n/labels" -f "labels[]=$new" >/dev/null
fi

# A real escalation: assign the configured human so it shows up in their GitHub inbox.
if [ "$new" = "agent:needs-human" ] && [ -n "${AGENT_ESCALATION_ASSIGNEE:-}" ]; then
  gh api -X POST "repos/$repo/issues/$n/assignees" -f "assignees[]=$AGENT_ESCALATION_ASSIGNEE" >/dev/null || true
fi

echo "#$n -> ${new:-<cleared>}"
