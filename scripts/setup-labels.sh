#!/usr/bin/env bash
# Creates (or updates) the agent state labels in a repository.
# Usage: scripts/setup-labels.sh owner/repo
set -euo pipefail

repo="${1:?usage: setup-labels.sh owner/repo}"

label() { gh label create "$1" --repo "$repo" --color "$2" --description "$3" --force; }

# Issue states
label "agent:start"           "ededed" "Ask the Analyst agent to pick up this issue"
label "agent:needs-info"      "fbca04" "Analyst is waiting for answers from a human"
label "agent:analyzed"        "c5def5" "Analysis done, Architect agent picks it up"
label "agent:design-review"   "d4c5f9" "Design waiting for human approval (apply agent:ready to approve)"
label "agent:ready"           "0e8a16" "Approved for implementation, Implementor agent picks it up"
label "agent:in-progress"     "1d76db" "Implementor agent is working"
label "agent:pr-open"         "5319e7" "A PR is open for this issue"
label "agent:out-of-scope"    "cccccc" "Analyst judged this not actionable"

# PR states
label "agent:review"            "c2e0c6" "Ask the Reviewer agent to review this PR"
label "agent:changes-requested" "e99695" "Reviewer requested changes, Implementor agent fixes them"
label "agent:approved"          "0e8a16" "Reviewer approved; waiting for a human to merge"

# Both
label "agent:needs-human"     "b60205" "Agents stopped; a human must decide"
