#!/usr/bin/env bash
# Prints how many comments on an issue/PR carry a role's handoff marker.
# Workflows compare the count before and after a run to verify the agent posted its comment.
#
# Usage: count-comments.sh <issue-or-pr-number> <role>   # e.g. count-comments.sh 42 analyst
set -euo pipefail

n="$1"
role="$2"
repo="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY must be set}"

bot="${AGENT_BOT_LOGIN:-}"   # only the agents' own comments count; outsiders can't forge markers

gh api --paginate "repos/$repo/issues/$n/comments" \
  --jq ".[] | select((\"$bot\" == \"\" or .user.login == \"$bot\") and (.body | contains(\"<!-- agent:$role -->\"))) | .id" | wc -l | tr -d ' '
