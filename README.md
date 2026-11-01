# Agentic dev team on GitHub

An autonomous team of Claude agents (**Analyst → Architect → Implementor ⇄ Reviewer → QA**, plus a **Lead** that makes the calls) that takes a GitHub issue all the way to a merged PR. Nobody has to prompt them: they talk to each other through issues, PRs, comments and labels. A human is only pulled in when the Lead escalates.

It runs on **GitHub Actions** (works on GitHub Free) with [`anthropics/claude-code-action`](https://github.com/anthropics/claude-code-action), authenticated with your **Claude subscription** (`claude setup-token`).

## How it works

```
 new issue ──► 🔍 Analyst ──► 🏛 Architect ──► 🛠 Implementor ──► 🧐 Reviewer ──► 🚦 Merge queue ──► 🧪 QA ──► ✅ merged
                  │               │  risk:low/med       opens PR      ▲     │ approve      │ up to date,   │ pass,    │
                  │               │                   + 🔎 preview    │     │              │ checks green  │ once     ▼
                  │               │                           fix ────┘◄────┴──────────────┴───────────────┘    🌐 production
                  │               │                       (Implementor)   changes · conflicts · red checks · defects
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
- **Every PR gets a live preview** at `…/pr-<N>/` (link posted on the PR). **The QA agent** tests a PR **once, at the front of the merge queue**: after the Reviewer approved it, the Integrator brought it up to date with the default branch and the required checks passed on that commit. Nothing else merges while QA tests, so QA tests exactly the code that lands, and conflicts with other PRs never cost a QA round (`AGENT_QA_STAGE=review` restores the older flow: QA right after the review, before the queue). QA waits until the preview serves the PR's exact commit, runs the project's Playwright e2e suite against it, then tests the acceptance criteria in a real headless Chrome (Playwright MCP). It also **compares the changed screens with the baseline** (production, i.e. the base branch without the PR) at desktop and phone width: any visual change the issue didn't ask for, such as clipped or overlapping controls, is a defect. It posts a report with **screenshots in the PR**, including the before/after pairs. Defects go back to the Implementor, with steps to reproduce.
- **The merge queue replaces the human merge.** The merge gate checks the approval and the risk, then puts the PR in the queue (`agent:queued`). High-risk changes (`risk:high`, set by the Architect) still go to a human unless you allow them explicitly. The **Integrator** merges queued PRs **one at a time**, oldest first: right before merging, it brings the PR up to date with the default branch, waits for the required checks on exactly that commit, and squash-merges exactly that commit. So CI always tests what lands, and every PR is updated and tested once, however many PRs run in parallel. Its own updates don't change the PR's changes, so they skip review. QA runs at the front of the queue, unless it already passed the same own changes (or the Lead or a human approved them).
- **One custom GitHub App** is the agents' identity. Events created by an App token *do* trigger other workflows. Events created by the default `GITHUB_TOKEN` don't, and that would break the chain.

| File | Purpose |
|---|---|
| [.github/agents/*.md](.github/agents/) | Role prompts (analyst, architect, implementor, reviewer, qa, lead). Review and version them like code |
| [.github/workflows/agent-*.yml](.github/workflows/) | One workflow per role, plus `agent-merge.yml` (merge gate: admits approved PRs to the queue), `agent-integrator.yml` (merge queue), `agent-watchdog.yml` and `agent-chat.yml` (human `@claude`) |
| [scripts/agents/](scripts/agents/) | Shell helpers the workflows run: [`transition.sh`](scripts/agents/transition.sh) (swaps `agent:*` state labels), [`count-comments.sh`](scripts/agents/count-comments.sh) (verifies handoffs, loop budgets), [`progress.sh`](scripts/agents/progress.sh) (issue progress log), [`pr-still-current.sh`](scripts/agents/pr-still-current.sh) (skips stale runs), [`queue.sh`](scripts/agents/queue.sh) / [`integrate.sh`](scripts/agents/integrate.sh) / [`sweep-conflicts.sh`](scripts/agents/sweep-conflicts.sh) / [`app-token.sh`](scripts/agents/app-token.sh) (merge queue; the last one renews the App token during long runs), [`same-own-changes.sh`](scripts/agents/same-own-changes.sh) / [`own-diff.sh`](scripts/agents/own-diff.sh) (did a PR's own edits change since its approval?), [`split.sh`](scripts/agents/split.sh) / [`subissues.sh`](scripts/agents/subissues.sh) (sub-issues), [`publish-pages.sh`](scripts/agents/publish-pages.sh) (gh-pages with retries), [`qa-passed.sh`](scripts/agents/qa-passed.sh) (did QA already pass these own changes?), [`url.sh`](scripts/agents/url.sh) (preview and production links). PR-triggered workflows run them from the default branch |
| [scripts/setup-labels.sh](scripts/setup-labels.sh) | Creates the labels |
| [scripts/install.sh](scripts/install.sh) | Copies the toolkit into another repository's working copy (without the project's own CI, deploy and preview workflows), and never overwrites changed files without `--force` |
| [scripts/doctor.sh](scripts/doctor.sh) | Checks a repository's wiring before the first issue: toolkit files, App variables and secrets, labels, required checks, and the QA, merge and link settings. Changes nothing |
| [scripts/sim/](scripts/sim/) | **Simulator** for the agent tooling: runs the real scripts and workflow steps against a simulated GitHub and scripted agents, through deterministic scenarios and a randomized matrix of real-world trouble (conflicts, flaky CI, lost webhooks, API errors, killed jobs, humans interfering). Proves nothing gets stuck and the merge queue never merges untested or unapproved code. [`agent-sim.yml`](.github/workflows/agent-sim.yml) runs it on PRs that change the tooling. See its [README](scripts/sim/README.md) |
| [.github/ISSUE_TEMPLATE/agent-task.yml](.github/ISSUE_TEMPLATE/agent-task.yml) | Issue form that starts the pipeline |
| [templates/CLAUDE.md](templates/CLAUDE.md) | Project guide every agent reads. Copy it to the target repo root as `CLAUDE.md` and fill it in |

## Setup (about 15 minutes)

1. **Copy the toolkit** into the target repo: `scripts/install.sh <path-to-target-checkout>` (re-run with `--force` to update it later). It also creates `CLAUDE.md` from the template: fill it in. The project needs a CI workflow with real tests: in autonomous mode, **tests are the safety net**. Not a Node project, or no preview deploys? See **Other stacks** below.
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
7. **Check the wiring:** `scripts/doctor.sh owner/repo`. It lists what's missing or doesn't fit together (e.g. a required check that matches no workflow, a merge method the repository doesn't allow, QA without a preview or a start command).
8. **Try it:** open an issue with the *Agent task* form, or add `agent:start` to any issue. Watch the Actions tab.

### Other stacks

The defaults fit a Node project with GitHub Pages previews (like this pilot). Everything stack-specific is a variable:

| Variable | Default | Use |
|---|---|---|
| `AGENT_NODE_VERSION` | `22` | `none` skips installing Node (QA's browser tools then use the runner's preinstalled Node) |
| `AGENT_SETUP_COMMAND` | | Runs before the Implementor and before QA's e2e setup, e.g. `pip install -r requirements.txt` or installing Go tools. Allow the Implementor's build commands with `AGENT_BUILD_TOOLS` |
| `AGENT_E2E_SETUP` | `npm ci` | QA's setup for the e2e suite (`none`: nothing) |
| `AGENT_E2E_COMMAND` | `npx playwright test` | QA's e2e suite, run with `E2E_BASE_URL` set to the site under test. `none`: no suite, QA only tests in the browser |
| `AGENT_PREVIEW_URL` | `https://{owner}.github.io/{repo}/pr-{pr}/` | Where each PR's preview lives (also linked from the issue). `none`: no preview deploys; QA starts the app on its runner instead |
| `AGENT_QA_START_COMMAND` | | With `AGENT_PREVIEW_URL=none`: starts the app in the background, e.g. `npm run build && npx serve out -l 3000` |
| `AGENT_QA_LOCAL_URL` | `http://localhost:3000/` | With `AGENT_PREVIEW_URL=none`: where the started app answers |
| `AGENT_PRODUCTION_URL` | `https://{owner}.github.io/{repo}/` | The deployed default branch, linked when a PR merges. `none`: no link |
| `AGENT_MERGE_METHOD` | `squash` | How the merge queue merges: `squash`, `merge` or `rebase` (the repository must allow it) |
| `AGENT_QA_SCREENSHOTS` | `pages` (public repos), `artifact` (private) | `pages`: QA screenshots go to the `gh-pages` branch and show inline in the PR. `artifact`: they stay in the run's artifacts and the PR links to them; for private repositories, where raw `gh-pages` image links don't render, and repos without `gh-pages` |

## Autonomy levels

| Variable | Supervised | **Autonomous** | Notes |
|---|---|---|---|
| `AGENT_AUTO_START` | – | `true` | New issues from collaborators enter the pipeline without a label |
| `AGENT_AUTONOMY` | – | `full` | The Lead answers the Analyst's questions instead of a human |
| `AGENT_REQUIRE_DESIGN_APPROVAL` | `true` | – | When `true`, every design waits for a human `agent:ready` |
| `AGENT_QA` | – | `true` | The QA agent tests every PR in the browser before it merges (needs a preview deploy) |
| `AGENT_QA_STAGE` | | | When QA runs. Unset or `queue`: once, at the front of the merge queue, on the up-to-date commit whose checks passed, while the queue waits. `review`: right after the Reviewer approves, before the queue (the older flow: conflicts and fixes after QA send the PR through QA again) |
| `AGENT_QA_ON_BASE_UPDATE` | – | – | Only with `AGENT_QA_STAGE=review`. `true`: QA tests an approved PR again after the Integrator merged the latest default branch into it, and the merge queue waits for it. Otherwise only CI re-runs |
| `AGENT_SKIP_REVIEW_ON_SAME_CHANGES` | – | `true` | `true`: when an approved PR is pushed again but its own added and removed lines are exactly as approved (typically a conflict resolution that kept both sides), skip the re-review, as for a clean update; CI tests the combination. Otherwise the Reviewer re-reviews, focused on how the PR's own edits changed |
| `AGENT_AUTO_MERGE` | – | `true` | **Kill switch** for the merge gate and the merge queue |
| `AGENT_PAUSED` | | | `true` pauses every agent job (see Human controls) |
| `AGENT_AUTO_MERGE_HIGH_RISK` | – | – | `true` lets the agents merge `risk:high` changes too (not recommended) |
| `AGENT_REQUIRED_CHECKS` | | `CI` | Comma-separated workflow names that must pass before merge |
| `AGENT_SPLIT` | | | `false` stops the Architect from splitting big issues into sub-issues |
| `AGENT_MAX_SUBISSUES` | `5` | `5` | Maximum sub-issues per split |
| `AGENT_MAX_REVIEW_ROUNDS` | `3` | `3` | Review rounds before the Lead steps in |
| `AGENT_QA_SCREENSHOT_DAYS` | `7` | `7` | Days QA screenshots stay after a PR closes ([pages-janitor.yml](.github/workflows/pages-janitor.yml) also squashes `gh-pages` weekly) |
| `AGENT_MAX_QA_ROUNDS` | `3` | `3` | Failed QA rounds before the Lead steps in |
| `AGENT_WATCHDOG_MINUTES` | `10` | `10` | The [watchdog](.github/workflows/agent-watchdog.yml) re-triggers items whose state hasn't moved this long while no agent run is queued or running for them. It runs this long after the last agent run finishes, plus every 10 minutes as a backup |
| `AGENT_WATCHDOG_RETRIES` | `2` | `2` | Watchdog retries per item (since the last Lead decision) before it goes to the Lead |
| `AGENT_IMPLEMENTOR_MAX_TURNS` | `150` | `150` | Turn budget of an Implementor run |
| `AGENT_MAX_LEAD_DECISIONS` | `3` | `3` | Lead decisions per item before a human is assigned |
| `AGENT_INTEGRATOR_MAX_ATTEMPTS` | `3` | `3` | Failed merge attempts per PR (red checks on the combined code, checks that don't finish, failed merges) since the last Lead decision before the Lead steps in. Conflicts don't count |
| `AGENT_INTEGRATOR_CHECKS_MINUTES` | `30` | `30` | How long the Integrator waits for the required checks before sending the PR to the back of the queue |
| `AGENT_INTEGRATOR_QA_MINUTES` | `60` | `60` | How long the queue waits for QA at its front. After that the queue moves on, and the PR rejoins it when QA passes |
| `AGENT_INTEGRATOR_DRAIN_MINUTES` | `100` | `100` | After this long, an Integrator run hands the rest of the queue to a fresh run (jobs can't run forever) |
| `AGENT_PREVIEW_URL` | | | Preview URL template for QA, default `https://{owner}.github.io/{repo}/pr-{pr}/`. The preview must serve `version.txt` containing the PR head SHA. `none`: no previews (see Other stacks) |
| `AGENT_BASELINE_URL` | | | The "before" site for QA's visual comparison: the base branch without the PR, default `https://{owner}.github.io/{repo}/` (production). It should serve `version.txt`, so QA knows when it lags the base branch. `none` turns the comparison off |
| `AGENT_MODEL` / `AGENT_REVIEWER_MODEL` / `AGENT_QA_MODEL` / `AGENT_LEAD_MODEL` | | | e.g. a cheaper model for the workers and a stronger one for Reviewer and Lead |

"–" means unset. Unset variables mean the more conservative behaviour.

## Human controls

You don't need to do anything in autonomous mode. These are overrides:

| You want to… | Do this |
|---|---|
| Start the pipeline on an issue | Add `agent:start` (automatic with `AGENT_AUTO_START`) |
| Handle an escalation | You're assigned; decide, then apply the next state label (e.g. `agent:ready`, `agent:review`) or close it |
| Ask the Lead to step in | Add `agent:needs-decision` |
| See what the agents are doing | The issue's "📋 Agent progress" comment, and the labels: `agent:fixing` means the Implementor is working on the PR right now (conflict, review or QA feedback), `agent:qa` that QA is testing it |
| See the merge queue | Filter PRs by `agent:integrating` (being merged now) and `agent:queued`. Each queued PR has a "Queued for merge" comment, and the Integrator's job summary lists the queue |
| Merge a PR through the queue | Add `agent:approved` (you approve its current head). It joins the back of the queue |
| Take a PR out of the queue | Mark it as draft (agents ignore drafts; mark it ready to send it through review and back into the queue). Removing `agent:queued` only takes it out for a moment: the watchdog sends unlabeled agent PRs back to review. Pushing to it also takes it out (it goes through review again) |
| Restart the merge queue | `gh workflow run agent-integrator.yml` (the watchdog also does this when PRs wait without an Integrator run) |
| Get a review of your own PR | Add `agent:review` |
| Ask for something ad hoc | Comment `@claude …` |
| Stop merging | Set `AGENT_AUTO_MERGE` to anything but `true`. A running Integrator finishes its current pass of the queue, so cancel its run too to stop at once. Queued PRs keep their place |
| Pause all agents | Set the repo variable `AGENT_PAUSED` to `true`: every agent job (including the merge gate and watchdog) skips. Events during the pause are not queued, so to resume, delete the variable and run the watchdog once (`gh workflow run agent-watchdog.yml`); it re-triggers everything that changed state meanwhile |
| Stop everything for good | Disable the workflows (Actions tab), or remove the `agent:*` labels |

## Safety rails built in

- Only the **owner, org members and collaborators** can trigger agents. Outsiders' issues and comments are filtered out before any job starts, agents ignore their comments, and handoff markers only count when the agents' bot posted them. Bots other than the team's App are rejected. The App is identified by its user id (`AGENT_BOT_ID`), so renaming it breaks nothing.
- On a public repo, consider limiting interactions to collaborators (up to 6 months, renewable): `gh api -X PUT repos/<owner>/<repo>/interaction-limits -f limit=collaborators_only -f expiry=six_months`.
- Each role gets a **least-privilege tool allowlist**. Analyst, Architect, Reviewer and Lead can't edit code or run git. The Implementor can edit, move (`git mv`), delete (`git rm`) and commit files and create folders, but can't force-push or push to the default branch. Denied tool calls are listed in the job summary.
- The App has no *Workflows* permission, so agents can't push changes to `.github/workflows/`. That permission doesn't cover the role prompts (`.github/agents/`) or the scripts (`scripts/`), so the merge gate never auto-merges a PR that touches `AGENT_PROTECTED_PATHS` (default `.github/,scripts/,templates/`): a human merges it.
- For PR-triggered runs, role prompts are loaded from the **default branch** (`.agent-trusted/`), so a PR can't rewrite its own reviewer instructions.
- Issue and PR text is treated as data, never as instructions (stated in every role prompt).
- The merge queue only merges the **exact commit that was approved**: every agent approval records its commit ([`approve.sh`](scripts/agents/approve.sh)), and anything pushed after it, by anyone, goes back to review. The only exception is the Integrator's own merge of the default branch into an approved commit ([`clean-base-update.sh`](scripts/agents/clean-base-update.sh) checks that it is GitHub's clean merge commit, not a hand-made one), which it records as approved. It merges with `--match-head-commit`, only after the required checks passed on that commit, and never `risk:high` by default: it checks the issue's risk and the protected paths again right before merging, in case they changed after the approval.
- **Verdicts never land on a changed PR.** Reviewer and QA re-check the PR just before applying their verdict; if it got new commits, a conflict flag or a Lead decision meanwhile, the verdict is dropped and the newer state stays.
- **Parallel PRs stay correct and cheap: the merge queue.** Without branch protection nothing forces a PR to include the latest default branch, and when each approved PR merged on its own, every merge made all other approved PRs update and test again (with N parallel PRs, O(N²) CI runs, plus re-reviews and QA rounds that used up their budgets), while two PRs whose checks finished together could both merge without ever being tested together. Now the Integrator ([`agent-integrator.yml`](.github/workflows/agent-integrator.yml), [`integrate.sh`](scripts/agents/integrate.sh)) is the only thing that merges, one PR at a time (one concurrency group for the repository; each run drains the whole queue, so GitHub dropping pending runs doesn't matter). It updates a PR right before merging it, tests exactly that commit, and checks that the default branch hasn't moved before it merges (else it updates again). Queued PRs aren't touched while they wait, so each is updated and tested once. Conflicts and checks that fail only on the combined code go back to the Implementor, with the merge queue's comment saying why. After a merge, other agent PRs that now conflict are sent to the Implementor at once ([`sweep-conflicts.sh`](scripts/agents/sweep-conflicts.sh)), so they're resolved while the queue moves on. After a conflict resolution, the Reviewer only reviews how the PR's own edits changed ([`same-own-changes.sh`](scripts/agents/same-own-changes.sh)), or skips the review when they didn't (`AGENT_SKIP_REVIEW_ON_SAME_CHANGES`). PR-driven agent workflows use `pull_request_target`, because GitHub runs no `pull_request` workflows for conflicting PRs. They only act on same-repo PRs. Queued Reviewer and QA runs first re-check the live PR (`pr-still-current.sh`) and skip when it has newer commits, a pending verdict, a conflict, or is in the merge queue, so no round is spent on stale code.
- **Dropped runs are re-queued.** Sub-issue runs (and the watchdog) sweep every open split issue, so a dropped sub-issue event is caught up by the next run.
- **Dropped review/QA handoffs are re-queued.** GitHub keeps only one pending run per concurrency group and silently cancels the older one. When a Reviewer or QA run skips because the PR waits in another agent's state, it re-applies that state, so a dropped handler gets queued again.
- **Nothing stalls silently:** a cancelled or crashed run leaves its state label behind with nothing working on it. The watchdog runs 10 minutes after agent runs finish, at most one check at a time, so a stall is caught within about 20 minutes even while other issues keep the agents busy (plus every 10 minutes as a backup, though GitHub's scheduler often skips those runs), finds such items, re-triggers them (twice by default), then hands them to the Lead, or to a human if the Lead is what stalls.
- **Budgets everywhere:** rejected review rounds and failed QA rounds (re-runs after base updates don't count), failed merge attempts in the merge queue (conflicts don't count), Lead decisions, `--max-turns` per role, `timeout-minutes` per job, one run at a time per issue or PR (`concurrency`).
- Every decision is a comment, so the issue and PR history is a complete audit trail.

## Costs and limits

- **Claude:** runs use your subscription. Headless and Agent SDK usage may draw from a separate monthly credit on Pro and Max plans, so check Anthropic's current Help Center article. One issue typically costs 4–8 agent runs (roughly $0.05–0.50 of usage each with Sonnet on a small repo; see `total_cost_usd` in the run logs). If you hit limits, lower `--max-turns` or set a cheaper `AGENT_MODEL`. For team-wide rollout, use a Team/Enterprise plan or a Console API key (`anthropic_api_key`), because an OAuth token is tied to one person's subscription.
- **GitHub Free:** Actions are free on public repos. Private repos get 2,000 minutes a month, and two things here add up: the watchdog's wait after each burst of agent activity occupies a runner (the length of the burst plus 10 minutes), and its 10-minute backup schedule bills about 144 minutes a day, because every job is rounded up to a full minute. On a private repo, make the backup hourly (`cron: "7 * * * *"`) or remove it. Also, the Integrator occupies one runner while the merge queue isn't empty: it polls CI for each PR in turn (up to 30 minutes each). Branch protection on private repos needs a paid plan; the merge gate enforces checks itself.

## Ideas for later

- A scheduled "maintainer" agent that triages stale issues and CI failures.
- Make the queue a hard rule: a branch ruleset that requires the `CI` check and up-to-date branches stops humans from merging untested combinations too (the Integrator already merges that way). In an organization-owned repo, GitHub's native merge queue could replace the Integrator.
- Batch the merge queue (test the first few queued PRs together, bisect on failure) if it often holds more than a handful of PRs.
- Move the workflows into a reusable workflow in an org-level repo once the pilot works.

## Kanban (sandbox project)

> The app and its CI/deploy workflows only exist on the `sandbox` branch, which is the default branch while piloting. They give the agents a real project to work on. `main` holds just the toolkit.

A Next.js 16 static app, live at **https://burak-akkas.github.io/agentic-dev-team/** and redeployed on every merge ([deploy.yml](.github/workflows/deploy.yml)). Every PR gets a preview at `…/agentic-dev-team/pr-<N>/` ([preview.yml](.github/workflows/preview.yml)). Both are published to the `gh-pages` branch.

```
npm ci
npm run dev     # http://localhost:3000
npm run check   # lint + typecheck + unit tests + build + e2e (what CI runs)
```

