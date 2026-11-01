#!/usr/bin/env bash
# Copies the agent team's toolkit into another repository's working copy:
#   .github/agents/            the role prompts
#   .github/workflows/agent-*  one workflow per role, the merge queue, the watchdog (not agent-sim.yml,
#                              which tests the toolkit itself), and pages-janitor.yml (QA screenshots)
#   scripts/agents/            the helper scripts the workflows call
#   scripts/setup-labels.sh, scripts/doctor.sh
#   CLAUDE.md                  from templates/CLAUDE.md, only if the target has none
# Project workflows (CI, deploy, preview) are the project's own and are never copied.
#
# Usage: scripts/install.sh <target-repo-dir> [--force]
#   Without --force, files that already exist in the target and differ are listed and left alone
#   (run again with --force to overwrite them, e.g. to update the toolkit). Identical files are skipped.
# Afterwards: commit and push in the target, then follow the printed next steps.
set -euo pipefail

target="${1:?usage: install.sh <target-repo-dir> [--force]}"
force="${2:-}"
src="$(cd "$(dirname "$0")/.." && pwd)"
[ -d "$target/.git" ] || { echo "install.sh: $target is not a git working copy" >&2; exit 1; }
target="$(cd "$target" && pwd)"
[ "$src" != "$target" ] || { echo "install.sh: the target is this repository" >&2; exit 1; }

files=$(cd "$src" && {
  find .github/agents scripts/agents -type f
  for w in .github/workflows/agent-*.yml; do [ "$w" = .github/workflows/agent-sim.yml ] || echo "$w"; done
  echo .github/workflows/pages-janitor.yml
  echo scripts/setup-labels.sh
  echo scripts/doctor.sh
} | sort)

copied=0; same=0; kept=()
while read -r f; do
  if [ -f "$target/$f" ]; then
    if cmp -s "$src/$f" "$target/$f"; then same=$((same + 1)); continue; fi
    if [ "$force" != "--force" ]; then kept+=("$f"); continue; fi
  fi
  mkdir -p "$target/$(dirname "$f")"
  cp -p "$src/$f" "$target/$f"
  copied=$((copied + 1))
done <<<"$files"

claude_md=""
if [ ! -f "$target/CLAUDE.md" ]; then
  cp "$src/templates/CLAUDE.md" "$target/CLAUDE.md"
  claude_md=" CLAUDE.md created from the template: fill in your project's commands and conventions."
fi

echo "Copied $copied file(s), $same already up to date.$claude_md"
if [ ${#kept[@]} -gt 0 ]; then
  echo "Left alone (they differ in the target; --force overwrites them):"
  printf '  %s\n' "${kept[@]}"
fi
cat <<EOF

Next steps (details in the toolkit's README):
  1. Commit and push these files to the target's default branch.
  2. Create a GitHub App for the agents, install it on the repository, then set
       variables  AGENT_APP_ID, AGENT_BOT_ID (the App's bot user id), and your choices (AGENT_QA, AGENT_AUTO_MERGE, …)
       secrets    AGENT_APP_PRIVATE_KEY, CLAUDE_CODE_OAUTH_TOKEN
  3. Not a Node project? Set AGENT_NODE_VERSION=none and AGENT_SETUP_COMMAND, and for QA AGENT_E2E_SETUP and
     AGENT_E2E_COMMAND (or none). No preview deploys? AGENT_PREVIEW_URL=none plus AGENT_QA_START_COMMAND.
  4. scripts/setup-labels.sh <owner/repo>
  5. scripts/doctor.sh <owner/repo>: checks the wiring before the first issue.
EOF
