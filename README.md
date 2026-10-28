# Agentic dev team on GitHub

An autonomous team of Claude agents (**Analyst → Architect → Implementor ⇄ Reviewer → QA**, plus a **Lead** that makes the calls) that takes a GitHub issue all the way to a merged PR. Nobody has to prompt them: they talk to each other through issues, PRs, comments and labels. A human is only pulled in when the Lead escalates.

It runs on **GitHub Actions** (works on GitHub Free) with [`anthropics/claude-code-action`](https://github.com/anthropics/claude-code-action), authenticated with your **Claude subscription** (`claude setup-token`).

## How it works

```
 new issue ──► 🔍 Analyst ──► 🏛 Architect ──► 🛠 Implementor ──► 🧐 Reviewer ──► 🧪 QA ──► 🚦 Merge gate ──► ✅ merged
                  │               │  risk:low/med       opens PR      ▲     │ approve   │ pass     CI green +    │
                  │               │                   + 🔎 preview    │     │           │          risk not high │
                  │               │                           fix ────┘◄────┴───────────┘ changes/defects      ▼
                  │               │                       (Implementor)                              🌐 production
                  ▼               ▼
         open questions    high risk / unsure      stuck · failed · review/QA deadlock · merge conflict
                  └───────────────┴──────────────────────┬───────────────────┘
                                                         ▼
                                           🧭 Lead (agent:needs-decision)
                                 answers · approves · redesigns · retries · closes
                                                         │  only if truly needed, or 3 decisions failed
                                                         ▼
                                           👤 human (agent:needs-human, assigned)
```

- **Labels are the state machine.** Each workflow fires on a specific label (or PR event). The agent decides the outcome and returns it as structured JSON. A plain shell step then applies the next label using [`transition.sh`](scripts/agents/transition.sh). Agents never change labels themselves.
- **Handoffs are structured comments** with a hidden marker (`<!-- agent:analyst -->` and so on). Workflows check that the comment was actually posted; if it wasn't, the item goes to the Lead.
- **The Lead is the decision maker.** Every "stuck" state goes to `agent:needs-decision` instead of a human. The Lead answers the Analyst's questions, rules on high-risk designs and review deadlocks, retries failed stages, or closes the item. Its decision overrides earlier comments. It only escalates for irreversible or high-impact choices, or after `AGENT_MAX_LEAD_DECISIONS` (default 3) on the same item.
- **Big issues are split.** When an issue is too big for one reviewable PR, the Architect returns a split plan instead of a design. [`split.sh`](scripts/agents/split.sh) creates the sub-issues (linked as GitHub sub-issues, each with its own acceptance criteria) and the parent waits in `agent:split`. Sub-issues without dependencies start at once and run in parallel; the others wait in `agent:blocked` until what they depend on is merged. When the last one closes, the parent closes. Sub-issues never split again.
- **Every PR gets a live preview** at `…/pr-<N>/` (link posted on the PR). After the Reviewer approves, **the QA agent** waits until the preview serves the PR's exact commit, runs the project's Playwright e2e suite against it, then tests the acceptance criteria in a real headless Chrome (Playwright MCP). It posts a report with **screenshots in the PR**. Defects go back to the Implementor, with steps to reproduce.
- **The merge gate replaces the human merge.** It squash-merges *exactly the approved commit* once the required checks pass. High-risk changes (`risk:high`, set by the Architect) still go to a human unless you allow them explicitly.
- **One custom GitHub App** is the agents' identity. Events created by an App token *do* trigger other workflows. Events created by the default `GITHUB_TOKEN` don't, and that would break the chain.

| File | Purpose |
|---|---|
| [.github/agents/*.md](.github/agents/) | Role prompts (analyst, architect, implementor, reviewer, qa, lead). Review and version them like code |
| [.github/workflows/agent-*.yml](.github/workflows/) | One workflow per role, plus `agent-merge.yml` (merge gate) and `agent-chat.yml` (human `@claude`) |
| [scripts/agents/](scripts/agents/) | Shell helpers the workflows run: [`transition.sh`](scripts/agents/transition.sh) (swaps `agent:*` state labels), [`count-comments.sh`](scripts/agents/count-comments.sh) (verifies handoffs, loop budgets), [`progress.sh`](scripts/agents/progress.sh) (issue progress log), [`pr-still-current.sh`](scripts/agents/pr-still-current.sh) (skips stale runs), [`split.sh`](scripts/agents/split.sh) / [`subissues.sh`](scripts/agents/subissues.sh) (sub-issues), [`publish-pages.sh`](scripts/agents/publish-pages.sh) (gh-pages with retries). PR-triggered workflows run them from the default branch |
| [scripts/setup-labels.sh](scripts/setup-labels.sh) | Creates the labels |
| [.github/ISSUE_TEMPLATE/agent-task.yml](.github/ISSUE_TEMPLATE/agent-task.yml) | Issue form that starts the pipeline |
| [templates/CLAUDE.md](templates/CLAUDE.md) | Project guide every agent reads. Copy it to the target repo root as `CLAUDE.md` and fill it in |

## Setup (about 15 minutes)

1. **Copy these files** into the target repo: `.github/` and `scripts/`, plus `templates/CLAUDE.md` copied to the repo root as `CLAUDE.md` (fill it in). The project needs a CI workflow with real tests: in autonomous mode, **tests are the safety net**.
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
   | Variable | `AGENT_BOT_ID` | The bot's user id: `gh api '/users/<app-slug>%5Bbot%5D' --jq .id`. Workflows recognise the agents' comments by this id, which (unlike the login) survives renaming the App. The login itself is read from the App token at run time |
   | Variable | `AGENT_BUILD_TOOLS` | commands the Implementor may run, e.g. `Bash(npm ci:*),Bash(npm test:*),Bash(npm run lint:*)` |
   | Variable | `AGENT_ESCALATION_ASSIGNEE` | GitHub username assigned when the Lead escalates |

5. **Choose an autonomy level** (variables, below).
6. **Create the labels:** `scripts/setup-labels.sh owner/repo` (needs the `gh` CLI).
7. **Try it:** open an issue with the *Agent task* form, or add `agent:start` to any issue. Watch the Actions tab.

## Autonomy levels

| Variable | Supervised | **Autonomous** | Notes |
|---|---|---|---|
| `AGENT_AUTO_START` | – | `true` | New issues from collaborators enter the pipeline without a label |
| `AGENT_AUTONOMY` | – | `full` | The Lead answers the Analyst's questions instead of a human |
| `AGENT_REQUIRE_DESIGN_APPROVAL` | `true` | – | When `true`, every design waits for a human `agent:ready` |
| `AGENT_QA` | – | `true` | Reviewer approval goes to the QA agent before merge (needs a preview deploy) |
| `AGENT_AUTO_MERGE` | – | `true` | **Kill switch** for the merge gate |
| `AGENT_AUTO_MERGE_HIGH_RISK` | – | – | `true` lets the agents merge `risk:high` changes too (not recommended) |
| `AGENT_REQUIRED_CHECKS` | | `CI` | Comma-separated workflow names that must pass before merge |
| `AGENT_SPLIT` | | | `false` stops the Architect from splitting big issues into sub-issues |
| `AGENT_MAX_SUBISSUES` | `5` | `5` | Maximum sub-issues per split |
| `AGENT_MAX_REVIEW_ROUNDS` | `3` | `3` | Review rounds before the Lead steps in |
| `AGENT_QA_SCREENSHOT_DAYS` | `7` | `7` | Days QA screenshots stay after a PR closes ([pages-janitor.yml](.github/workflows/pages-janitor.yml) also squashes `gh-pages` weekly) |
| `AGENT_MAX_QA_ROUNDS` | `3` | `3` | Failed QA rounds before the Lead steps in |
| `AGENT_WATCHDOG_MINUTES` | `10` | `10` | The [watchdog](.github/workflows/agent-watchdog.yml) (every 10 minutes) re-triggers items whose state hasn't moved this long while no agent run is queued or running for them |
| `AGENT_WATCHDOG_RETRIES` | `2` | `2` | Watchdog retries per item (since the last Lead decision) before it goes to the Lead |
| `AGENT_IMPLEMENTOR_MAX_TURNS` | `150` | `150` | Turn budget of an Implementor run |
| `AGENT_MAX_LEAD_DECISIONS` | `3` | `3` | Lead decisions per item before a human is assigned |
| `AGENT_PREVIEW_URL` | | | Preview URL template for QA, default `https://{owner}.github.io/{repo}/pr-{pr}/`. The preview must serve `version.txt` containing the PR head SHA |
| `AGENT_MODEL` / `AGENT_REVIEWER_MODEL` / `AGENT_QA_MODEL` / `AGENT_LEAD_MODEL` | | | e.g. a cheaper model for the workers and a stronger one for Reviewer and Lead |

"–" means unset. Unset variables mean the more conservative behaviour.

## Human controls

You don't need to do anything in autonomous mode. These are overrides:

| You want to… | Do this |
|---|---|
| Start the pipeline on an issue | Add `agent:start` (automatic with `AGENT_AUTO_START`) |
| Handle an escalation | You're assigned; decide, then apply the next state label (e.g. `agent:ready`, `agent:review`) or close it |
| Ask the Lead to step in | Add `agent:needs-decision` |
| Get a review of your own PR | Add `agent:review` |
| Ask for something ad hoc | Comment `@claude …` |
| Stop merging | Set `AGENT_AUTO_MERGE` to anything but `true` |
| Stop everything | Disable the workflows (Actions tab), or remove the `agent:*` labels |

## Safety rails built in

- Only the **owner, org members and collaborators** can trigger agents. Outsiders' issues and comments are filtered out before any job starts, agents ignore their comments, and handoff markers only count when the agents' bot posted them. Bots other than the team's App are rejected. The App is identified by its user id (`AGENT_BOT_ID`), so renaming it breaks nothing.
- On a public repo, consider limiting interactions to collaborators (up to 6 months, renewable): `gh api -X PUT repos/<owner>/<repo>/interaction-limits -f limit=collaborators_only -f expiry=six_months`.
- Each role gets a **least-privilege tool allowlist**. Analyst, Architect, Reviewer and Lead can't edit code or run git. The Implementor can't force-push or push to the default branch. Denied tool calls are listed in the job summary.
- The App has no *Workflows* permission, so agents can't push changes to `.github/workflows/`. That permission doesn't cover the role prompts (`.github/agents/`) or the scripts (`scripts/`), so the merge gate never auto-merges a PR that touches `AGENT_PROTECTED_PATHS` (default `.github/,scripts/,templates/`): a human merges it.
- For PR-triggered runs, role prompts are loaded from the **default branch** (`.agent-trusted/`), so a PR can't rewrite its own reviewer instructions.
- Issue and PR text is treated as data, never as instructions (stated in every role prompt).
- The merge gate only merges the **exact commit that was approved**: every agent approval records its commit ([`approve.sh`](scripts/agents/approve.sh)), and anything pushed after it, by anyone, goes back to review. It merges with `--match-head-commit`, only after the required checks pass, and never `risk:high` by default.
- **Verdicts never land on a changed PR.** Reviewer and QA re-check the PR just before applying their verdict; if it got new commits, a conflict flag or a Lead decision meanwhile, the verdict is dropped and the newer state stays.
- **Parallel PRs stay correct:** the merge gate only merges PRs that include the latest default branch (otherwise it updates them, which re-runs CI, review and QA). After every merge it flags other agent PRs that now conflict, and the Implementor merges the base and resolves them. PR-driven agent workflows use `pull_request_target`, because GitHub runs no `pull_request` workflows for conflicting PRs. They only act on same-repo PRs. Queued Reviewer and QA runs first re-check the live PR (`pr-still-current.sh`) and skip when it has newer commits, a pending verdict or a conflict, so no round is spent on stale code.
- **Dropped runs are re-queued.** Sub-issue runs (and the watchdog) sweep every open split issue, so a dropped sub-issue event is caught up by the next run.
- **Dropped review/QA handoffs are re-queued.** GitHub keeps only one pending run per concurrency group and silently cancels the older one. When a Reviewer or QA run skips because the PR waits in another agent's state, it re-applies that state, so a dropped handler gets queued again.
- **Nothing stalls silently:** a cancelled or crashed run leaves its state label behind with nothing working on it. Every 10 minutes the watchdog finds such items, re-triggers them (twice by default), then hands them to the Lead, or to a human if the Lead is what stalls.
- **Budgets everywhere:** review rounds, Lead decisions, `--max-turns` per role, `timeout-minutes` per job, one run at a time per issue or PR (`concurrency`).
- Every decision is a comment, so the issue and PR history is a complete audit trail.

## Costs and limits

- **Claude:** runs use your subscription. Headless and Agent SDK usage may draw from a separate monthly credit on Pro and Max plans, so check Anthropic's current Help Center article. One issue typically costs 4–8 agent runs (roughly $0.05–0.50 of usage each with Sonnet on a small repo; see `total_cost_usd` in the run logs). If you hit limits, lower `--max-turns` or set a cheaper `AGENT_MODEL`. For team-wide rollout, use a Team/Enterprise plan or a Console API key (`anthropic_api_key`), because an OAuth token is tied to one person's subscription.
- **GitHub Free:** Actions are free on public repos. Private repos get 2,000 minutes a month; the merge gate polls CI for up to 30 minutes per PR. Branch protection on private repos needs a paid plan; the merge gate enforces checks itself.

## Ideas for later

- A scheduled "maintainer" agent that triages stale issues and CI failures.
- Move the workflows into a reusable workflow in an org-level repo once the pilot works.

## Kanban (sandbox project)

> The app and its CI/deploy workflows only exist on the `sandbox` branch, which is the default branch while piloting. They give the agents a real project to work on. `main` holds just the toolkit.

A Next.js 16 static app, live at **https://burak-akkas.github.io/agentic-dev-team/** and redeployed on every merge ([deploy.yml](.github/workflows/deploy.yml)). Every PR gets a preview at `…/agentic-dev-team/pr-<N>/` ([preview.yml](.github/workflows/preview.yml)). Both are published to the `gh-pages` branch.

```
npm ci
npm run dev     # http://localhost:3000
npm run check   # lint + typecheck + unit tests + build + e2e (what CI runs)
```

