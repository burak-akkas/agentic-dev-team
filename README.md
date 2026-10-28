# Agentic dev team on GitHub

Four Claude agents (**Analyst → Architect → Implementor ⇄ Reviewer**) that work an issue all the way to a reviewed PR. Nobody has to prompt them: they talk to each other through GitHub issues, PRs, comments and labels. Humans stay in control through labels, `@claude` mentions and the final merge.

It runs on **GitHub Actions** (works on GitHub Free) with [`anthropics/claude-code-action`](https://github.com/anthropics/claude-code-action), authenticated with your **Claude subscription** (`claude setup-token`).

## How it works

```
 issue (agent:start) ──► 🔍 Analyst ──┬─► agent:needs-info ──(human replies)──► Analyst again
                                     ├─► agent:out-of-scope
                                     ▼
                              agent:analyzed
                                     ▼
                              🏛 Architect ──┬─► agent:design-review ──(human applies agent:ready)──┐
                                     │      │   (high risk, or approval required)                │
                                     ▼      └─► agent:needs-human                                 │
                               agent:ready ◄──────────────────────────────────────────────────────┘
                                     ▼
                              🛠 Implementor ──► branch agent/issue-N + PR "Closes #N"   (issue: agent:pr-open)
                                     ▼
                              🧐 Reviewer ──┬─► agent:approved ──► 👤 human merges
                                  ▲         ├─► agent:needs-human
                                  │         ▼
                                  │   agent:changes-requested
                                  │         ▼
                                  └── 🛠 Implementor (fix mode) pushes ─┘   (max N rounds, then needs-human)
```

- **Labels are the state machine.** Each workflow fires on a specific label (or PR event). The agent decides the outcome and returns it as structured JSON. A plain shell step then applies the next label using [`transition.sh`](.github/agents/transition.sh). Agents never change labels themselves.
- **Handoffs are structured comments**, each tagged with a hidden marker (`<!-- agent:analyst -->` and so on), so every agent and every human can see exactly what was decided.
- **One custom GitHub App** is the agents' identity. Events created by an App token *do* trigger other workflows. Events created by the default `GITHUB_TOKEN` don't, and that would break the chain.

| File | Purpose |
|---|---|
| [.github/agents/*.md](.github/agents/) | Role prompts. Review and version them like code |
| [.github/workflows/agent-*.yml](.github/workflows/) | One workflow per role, plus `agent-chat.yml` for human `@claude` requests |
| [.github/agents/transition.sh](.github/agents/transition.sh) | Swaps `agent:*` state labels |
| [scripts/setup-labels.sh](scripts/setup-labels.sh) | Creates the labels |
| [.github/ISSUE_TEMPLATE/agent-task.yml](.github/ISSUE_TEMPLATE/agent-task.yml) | Issue form that starts the pipeline |
| [CLAUDE.md](CLAUDE.md) | Project guide every agent reads. **Fill this in** |

## Setup (about 15 minutes)

1. **Copy these files** into the target repo: `.github/`, `scripts/`, and `CLAUDE.md` (fill it in).
2. **Create a GitHub App** (Settings → Developer settings → GitHub Apps → New). It's free on any plan.
   - Name, e.g. `acme-agents`. Disable the webhook.
   - Repository permissions: **Contents: R/W, Issues: R/W, Pull requests: R/W, Checks: Read, Commit statuses: Read, Actions: Read**, Metadata: Read.
   - Deliberately **do not** grant *Workflows* permission. That way agents can't change CI.
   - Create it, note the **App ID**, generate a **private key**, and install the app on the repo.
3. **Get a Claude token:** run `claude setup-token` locally (needs Pro, Max, Team or Enterprise).
4. **Add secrets and variables** (repo → Settings → Secrets and variables → Actions):

   | Kind | Name | Value |
   |---|---|---|
   | Secret | `CLAUDE_CODE_OAUTH_TOKEN` | output of `claude setup-token` |
   | Secret | `AGENT_APP_PRIVATE_KEY` | contents of the `.pem` file |
   | Variable | `AGENT_APP_ID` | App ID |
   | Variable | `AGENT_BOT_LOGIN` | `<app-slug>[bot]`, e.g. `acme-agents[bot]` |
   | Variable | `AGENT_BOT_ID` | `gh api '/users/acme-agents[bot]' --jq .id` (used for the commit email) |
   | Variable | `AGENT_BUILD_TOOLS` | commands the Implementor may run, e.g. `Bash(npm ci:*),Bash(npm test:*),Bash(npm run lint:*)` |
   | Variable *(optional)* | `AGENT_AUTO_START` | `true` = every new issue from a collaborator enters the pipeline |
   | Variable *(optional)* | `AGENT_REQUIRE_DESIGN_APPROVAL` | `true` = a human approves every design (recommended at first) |
   | Variable *(optional)* | `AGENT_MAX_REVIEW_ROUNDS` | default `3` |
   | Variable *(optional)* | `AGENT_MODEL` / `AGENT_REVIEWER_MODEL` | e.g. a cheaper model for the Implementor and a stronger one for the Reviewer |

5. **Create the labels:** `scripts/setup-labels.sh owner/repo` (needs the `gh` CLI).
6. **Try it:** open an issue with the *Agent task* form, or add `agent:start` to any issue. Watch the Actions tab.

## Human controls

| You want to… | Do this |
|---|---|
| Start the pipeline on an issue | Add `agent:start` |
| Answer the Analyst's questions | Reply on the issue (while it is in `agent:needs-info`) |
| Approve a design | Add `agent:ready` |
| Ask for a redesign | Comment with feedback, then re-add `agent:analyzed` |
| Get a review of your own PR | Add `agent:review` |
| Ask for something ad hoc | Comment `@claude …` |
| Stop everything | Remove the `agent:*` labels, or disable the workflows |

## Safety rails built in

- Only users with **write access** can trigger agents (the action checks this). Bots other than `AGENT_BOT_LOGIN` are rejected.
- Each role gets a **least-privilege tool allowlist**. Analyst, Architect and Reviewer can't edit code or run git. The Implementor can't force-push or push to the default branch.
- For PR-triggered runs, role prompts are loaded from the **default branch** (`.agent-trusted/`), so a PR can't rewrite its own reviewer instructions.
- Issue and PR text is treated as data, never as instructions (stated in every role prompt).
- **Loop guards:** a review-round cap, `--max-turns` per role, `timeout-minutes` per job, one run at a time per issue or PR (`concurrency`). Any failure lands in `agent:needs-human`.
- Agents never merge. A human always does.

## Costs and limits

- **Claude:** runs use your subscription. Headless and Agent SDK usage may draw from a separate monthly credit on Pro and Max plans, so check Anthropic's current Help Center article. One issue typically costs 4–8 agent runs. If you hit limits, lower `--max-turns` or set a cheaper `AGENT_MODEL`. For team-wide rollout, use a Team/Enterprise plan or a Console API key (`anthropic_api_key`), because an OAuth token is tied to one person's subscription.
- **GitHub Free:** Actions are free on public repos. Private repos get 2,000 minutes a month. Branch protection on private repos needs a paid plan, so on Free the "human merges" rule is a team convention.

## Ideas for later

- The Architect splits large issues into sub-issues, each going through the pipeline.
- A QA/Tester role that runs end-to-end tests against a preview deploy.
- A scheduled "maintainer" agent that triages stale issues and CI failures.
- Move the workflows into a reusable workflow in an org-level repo once the pilot works.
