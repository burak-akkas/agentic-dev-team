#!/usr/bin/env bash
# Advances a split issue after one of its sub-issues closed:
#   - closed as completed: unblocks sub-issues whose dependencies are all completed,
#     and closes the parent once every sub-issue is completed
#   - closed as not planned: hands the parent to the Lead (dependents can't start)
# Only markers written by the agents' bot count, like everywhere else.
#
# Usage: subissues.sh <closed-sub-issue>
# Needs GH_TOKEN, GITHUB_REPOSITORY and AGENT_BOT_ID (the bot's user id; it survives App renames).
set -euo pipefail

closed="$1"
repo="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY must be set}"
bot="${AGENT_BOT_ID:?AGENT_BOT_ID must be set}"
here="$(dirname "$0")"

issue=$(gh api "repos/$repo/issues/$closed")
if [ "$(echo "$issue" | jq -r .user.id)" != "$bot" ]; then
  echo "#$closed was not created by the agents' bot, nothing to do"; exit 0
fi
parent=$(echo "$issue" | jq -r '(.body // "") | capture("<!-- agent:sub-issue parent=(?<p>[0-9]+)").p // empty')
[ -z "$parent" ] && { echo "#$closed is not a sub-issue"; exit 0; }

children=$(gh api --paginate "repos/$repo/issues/$parent/comments" \
  --jq ".[] | select(.user.id == $bot) | (.body // \"\") | capture(\"<!-- agent:split (?<n>[0-9,]+) -->\").n" | tail -1 | tr ',' ' ')
[ -z "$children" ] && { echo "::warning::#$parent has no split marker"; exit 0; }

if [ "$(echo "$issue" | jq -r .state_reason)" = "not_planned" ]; then
  "$here/transition.sh" "$parent" agent:needs-decision >/dev/null
  gh issue comment "$parent" -R "$repo" --body "⚠️ Sub-issue #$closed was closed as **not planned**. Sub-issues that depend on it stay blocked. Lead: decide whether to unblock them (apply \`agent:analyzed\`), close them, or close this issue."
  exit 0
fi

# Sub-issues closed as completed, as " 12 14 " (a plain list keeps this portable to bash 3)
completed=" "
for c in $children; do
  s=$(gh api "repos/$repo/issues/$c" --jq '"\(.state) \(.state_reason // "")"')
  [ "$s" = "closed completed" ] && completed="$completed$c "
done

remaining=0
for c in $children; do
  [[ "$completed" == *" $c "* ]] && continue
  remaining=$((remaining + 1))
  child=$(gh api "repos/$repo/issues/$c")
  [ "$(echo "$child" | jq -r .state)" = "open" ] || continue
  echo "$child" | jq -e '[.labels[].name] | index("agent:blocked")' >/dev/null || continue
  deps=$(echo "$child" | jq -r '(.body // "") | capture("<!-- agent:sub-issue parent=[0-9]+ depends=(?<d>[0-9,]*)").d // ""' | tr ',' ' ')
  ready=true
  for d in $deps; do [[ "$completed" == *" $d "* ]] || ready=false; done
  if [ "$ready" = "true" ]; then
    "$here/transition.sh" "$c" agent:analyzed >/dev/null
    "$here/progress.sh" "$c" "🧩 **Unblocked**: its dependencies are done, starting design"
    "$here/progress.sh" "$parent" "🧩 #$closed done, **#$c** unblocked"
    echo "Unblocked #$c"
  fi
done

if [ "$remaining" -eq 0 ]; then
  list=$(for c in $children; do printf -- '- #%s\n' "$c"; done)
  gh issue comment "$parent" -R "$repo" --body "✅ All sub-issues are done:
$list

Closing this issue." >/dev/null
  "$here/transition.sh" "$parent" agent:done >/dev/null
  gh issue close "$parent" -R "$repo" --reason completed >/dev/null
  "$here/progress.sh" "$parent" "✅ **All sub-issues done**, closed"
  echo "Closed #$parent"
else
  "$here/progress.sh" "$parent" "🧩 #$closed done, $remaining sub-issue(s) left"
fi
