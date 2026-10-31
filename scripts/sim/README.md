# Agent team simulator

Tests the agent tooling (`scripts/agents/`, the `agent-*` workflows) against a simulated GitHub, so
you can check that the team never gets stuck and the merge queue never merges something it shouldn't,
before a change reaches a real repository. It runs the **real** scripts and workflow steps, extracted
from the workflow files; only GitHub (`gh`) and the LLM agents are simulated.

Needs Python 3 with PyYAML, `jq`, `bash` and `flock` (util-linux). No network.

```bash
python3 scripts/sim/test_scenarios.py          # deterministic scenarios, ~1 minute
python3 scripts/sim/matrix.py --quick --seeds 3  # randomized fast set, ~5 minutes
python3 scripts/sim/matrix.py                    # every profile, 6 seeds each, ~30 minutes
```

`agent-sim.yml` runs the first two on every PR that changes the agent tooling.

## The pieces

| File | What it does |
|---|---|
| [`fakegh/gh`](fakegh/gh) | A fake `gh` CLI that keeps a whole repository in a JSON file: PRs, issues, labels, comments, commits, CI checks, merges. It answers the calls the scripts make, injects trouble (API errors, mergeability `UNKNOWN`, slow or hanging CI, failing merges, refused branch updates) and **audits every merge** |
| [`fakegh/date`](fakegh/date), [`fakegh/sleep`](fakegh/sleep) | Virtual time: `date +%s` moves 60 s per call and `sleep` returns at once, so "wait 30 minutes" takes 30 polls |
| [`simlib.py`](simlib.py) | Builds fake repositories and runs a script, a workflow step or the Integrator against them |
| [`test_scenarios.py`](test_scenarios.py) | Exact situations with exact expected outcomes: one per path through the Integrator, the merge gate, the Reviewer's guard, `pr-still-current.sh`, `same-own-changes.sh` and the watchdog, plus a regression test for every bug the simulator found |
| [`team.py`](team.py) | The whole team on a fake repository, **concurrently**: GitHub events start runs under GitHub's concurrency rules (one running and one pending run per group, a newer pending run replaces the older one, the merge gate cancels its running run). Scripted stand-ins play the LLM roles (Reviewer and QA verdicts, Implementor fixes and conflict resolutions, Lead decisions); humans and GitHub misbehave as the parameters say. Runs until the repository settles, then classifies every PR |
| [`profiles.json`](profiles.json) | Scenario profiles: number of parallel PRs and the parameters that differ from `team.py`'s `DEFAULTS` |
| [`matrix.py`](matrix.py) | Runs profiles × seeds in parallel and prints the matrix. Exits 1 on any problem |

## What counts as a problem

When the repository has settled (nothing running or pending, and a watchdog run changed nothing),
every PR must be **merged**, **closed** or a **draft** (by a human), or **escalated to a human**
(`agent:needs-human`). Anything else is **STUCK**. Running more than 2500 jobs or 20 minutes is a
**LIVELOCK**. Besides that:

- **Unsafe merge**: a merged commit that wasn't up to date with the base, wasn't green, wasn't the
  approved commit, or wasn't merged by the Integrator (checked on every merge by the fake gh)
- **Merged PR left in an agent state** (e.g. `agent:changes-requested` on a merged PR)
- **Comment storm**: more than 80 comments on one PR
- **Unexpected failure**: a script or step failing without an injected cause (API errors, killed jobs)

A problem keeps the run's state directory (`state.json` has the whole repository, every `gh` call in
`log`, and `violations`). Re-run one simulation with `team.py --seed N --prs M --params '…' --keep`, or
`--sequential` for a reproducible order.

## Parameters (`team.py` `DEFAULTS`)

| Group | Parameters |
|---|---|
| Agents | `review_ok`, `qa_ok` (verdict pass rates), `keep_edits` (a conflict resolution keeps the PR's own edits as they were), `impl_blocked`, `lead_fix` |
| CI per new commit | `ci_fail`, `ci_hang` (pending forever), `ci_none` (the required check never reports), `ci_slow` (pending for 1–8 polls) |
| Merging | `conflict` (chance that a merge makes another PR conflict), `merge_fail`, `merge_err` (merged, but `gh` reports an error), `workflow_change` (a human merges workflow changes, so update-branch is refused) |
| GitHub | `drop` (lost webhook), `dup` (delivered twice), `api_flake` (any `gh` call fails), `unknown` (mergeability `UNKNOWN`), `kill_integrator` (the Integrator job is killed mid-run) |
| Humans | `human_base` (merges by hand), `human_push`, `human_draft`, `human_close`, `human_approve` (applies `agent:approved`), `human_lead` (applies `agent:needs-decision`) |
| Issues | `risk_high`, `protected` (the PR touches `.github/`) |
| Switches | `pause_window`, `automerge_off_window`: `[from, to)` in started jobs |
| Variables | `qa`, `qa_on_update`, `skip_same`, `drain_minutes`, `checks_minutes`, `qa_minutes` |

## Comparing with an older version

A profile with `"legacy_ref": "<commit>"` runs that commit's merge gate, Reviewer and scripts
instead, with the same simulated team. `profiles.json` compares the merge queue with `5673863`, the
last commit before it (on `main`; skipped when the commit isn't in the checkout).

## Extending it

- **A new real-world situation**: add a parameter to `DEFAULTS`, act on it in `Team.world()` (humans),
  `Team.route()` (event delivery) or the fake gh (GitHub's behaviour), and add a profile.
- **A new script or workflow step**: if it calls `gh` in a way the fake doesn't know yet, the fake
  fails with `fake gh: unsupported …`. Add the call to `fakegh/gh`, and a scenario to `test_scenarios.py`.
- **A bug found**: add a scenario that reproduces it (the fake's `hooks` let another "run" act at an
  exact call, e.g. push a commit during `gh pr checks`), then fix it.
