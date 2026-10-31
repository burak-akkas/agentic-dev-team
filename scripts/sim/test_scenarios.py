#!/usr/bin/env python3
"""Deterministic scenario tests for the merge queue and the scripts around it.

Each test sets up a fake repository, runs the real script or workflow step against the fake gh, and
checks the outcome. Run: python3 scripts/sim/test_scenarios.py [name-filter]
"""
import sys
sys.dont_write_bytecode = True   # keep __pycache__ out of the repository

import os, sys, tempfile, traceback

from simlib import (approval, bodies, bot_comment, files, labels, make_state, queued, run, sha, steps, subst)

TESTS = []


def test(fn):
    TESTS.append(fn)
    return fn


def two_queued(**extra):
    return make_state({
        101: {"head": sha(0xa1), "issue": 11, "comments": [approval(sha(0xa1)), queued()]},
        102: {"head": sha(0xb1), "issue": 12, "comments": [approval(sha(0xb1)), queued()]},
    }, **extra)


def updates_of(st, n):
    return [e for e in st["events"] if e[0] == "synchronize" and e[1] == str(n) and e[3] == "update"]


# --- the queue -------------------------------------------------------------------------------
@test
def two_prs_merge_in_order_and_the_second_is_updated_once():
    st = run(two_queued())
    assert st.get("merged") == [101, 102], st["_summary"]
    assert len(updates_of(st, 102)) == 1
    assert any("agent:approved-sha %s" % st["items"]["102"]["head"] in b for b in bodies(st, 102))
    assert labels(st, 101) == labels(st, 102) == labels(st, 11) == ["agent:done"]
    assert all(a["up_to_date"] and a["green"] and a["approved"] and a["by_integrator"] for a in st["merge_audit"])
    assert not st.get("violations")


@test
def queue_order_follows_the_admission_comment():
    st = run(make_state({
        101: {"head": sha(0xa1), "comments": [approval(sha(0xa1))]},          # no admission comment: last
        102: {"head": sha(0xb1), "comments": [approval(sha(0xb1)), queued()]},
    }))
    assert st.get("merged") == [102, 101]


@test
def queue_sh_lists_integrating_first_then_oldest():
    st = run(make_state({
        105: {"head": sha(0xe1), "comments": [queued()]},
        104: {"head": sha(0xd1), "comments": [queued()]},
        106: {"head": sha(0xf1), "labels": ["agent:integrating"], "comments": [queued()]},
        107: {"head": sha(0xf2), "labels": ["agent:review"]},
        108: {"head": sha(0xf3), "draft": True, "comments": [queued()]},
    }), script="queue.sh")
    assert st["_stdout"].split("\n")[:3] == ["106 integrating", "105 queued", "104 queued"], st["_stdout"]
    assert "108" not in st["_stdout"]


@test
def red_checks_on_the_combined_code_go_to_the_implementor():
    st = run(two_queued(check_plan=["pass", "fail"]))
    assert st.get("merged") == [101]
    assert labels(st, 102) == ["agent:changes-requested"]
    b = "\n".join(bodies(st, 102))
    assert "<!-- agent:merge -->" in b and "<!-- agent:integration-failed -->" in b and "combined code" in b


@test
def conflict_goes_to_the_implementor_without_counting():
    st = run(make_state({101: {"head": sha(0xa1), "conflict": True, "comments": [approval(sha(0xa1)), queued()]}}))
    assert labels(st, 101) == ["agent:changes-requested"]
    assert not any("integration-failed" in b for b in bodies(st, 101))


@test
def head_moved_after_approval_goes_back_to_review():
    st = run(make_state({101: {"head": sha(0xa2), "comments": [approval(sha(0xa1)), queued()]}}))
    assert labels(st, 101) == ["agent:review"] and not st.get("merged")


@test
def unapproved_pr_labeled_queued_by_hand_is_not_merged():
    st = run(make_state({101: {"head": sha(0xa1)}}))
    assert not st.get("merged") and labels(st, 101) == ["agent:review"]


@test
def third_failed_attempt_goes_to_the_lead_and_a_lead_decision_resets():
    fails = [bot_comment("<!-- agent:integration-failed -->")] * 2
    st = run(make_state({101: {"head": sha(0xa1), "comments": [approval(sha(0xa1))] + fails + [queued()]}},
                        checks={sha(0xa1): "fail"}))
    assert labels(st, 101) == ["agent:needs-decision"]
    st = run(make_state({101: {"head": sha(0xa1), "comments": fails + [bot_comment("<!-- agent:lead -->"), approval(sha(0xa1)), queued()]}},
                        checks={sha(0xa1): "fail"}))
    assert labels(st, 101) == ["agent:changes-requested"]


@test
def checks_that_never_finish_send_the_pr_to_the_back_once_per_run():
    st = run(make_state({101: {"head": sha(0xa1), "comments": [approval(sha(0xa1)), queued()]}}, checks={sha(0xa1): "hang"}))
    assert labels(st, 101) == ["agent:queued"] and "#101: requeued" in st["_summary"]
    assert st["_summary"].count("#101:") == 1
    assert ["labeled", "101", "agent:queued"] in st["events"]   # starts the next run


@test
def required_check_that_never_reports_is_a_timeout_not_a_hang():
    st = run(make_state({101: {"head": sha(0xa1), "comments": [approval(sha(0xa1)), queued()]}}, checks={sha(0xa1): "none"}))
    assert labels(st, 101) == ["agent:queued"] and "didn't finish" in bodies(st, 101)[-1]


@test
def slow_checks_are_waited_for():
    st = run(make_state({101: {"head": sha(0xa1), "comments": [approval(sha(0xa1)), queued()]}}, checks={sha(0xa1): "slow:12"}))
    assert st.get("merged") == [101]


@test
def failed_merge_goes_to_the_back_of_the_queue():
    st = run(make_state({101: {"head": sha(0xa1), "merge_fails": 1, "comments": [approval(sha(0xa1)), queued()]}}))
    assert labels(st, 101) == ["agent:queued"] and "requeued" in st["_summary"]


@test
def merge_that_succeeds_but_gh_reports_an_error_counts_as_merged():
    # Regression: the merged PR used to loop again and be sent to the Implementor as conflicting.
    st = run(make_state({
        101: {"head": sha(0xa1), "merge_error_after": True, "comments": [approval(sha(0xa1)), queued()]},
        102: {"head": sha(0xb1), "comments": [approval(sha(0xb1)), queued()]},
    }))
    assert st.get("merged") == [101, 102] and labels(st, 101) == ["agent:done"], (labels(st, 101), bodies(st, 101)[-1])


@test
def a_crashed_pr_in_integrating_is_picked_first():
    st = run(make_state({
        101: {"head": sha(0xa1), "comments": [approval(sha(0xa1)), queued()]},
        102: {"head": sha(0xb1), "labels": ["agent:integrating"], "comments": [approval(sha(0xb1)), queued()]},
    }))
    assert st.get("merged") == [102, 101]


@test
def merging_makes_a_queued_pr_conflict_and_the_sweep_sends_it_back():
    st = make_state({
        101: {"head": sha(0xa1), "comments": [approval(sha(0xa1)), queued()]},
        103: {"head": sha(0xc1), "comments": [approval(sha(0xc1)), queued()]},
    })
    # the merge of 101 makes 103 conflict; the sweep after the merge finds it
    st["hooks"] = [{"match": "pr merge 101", "pr": 103, "labels": ["agent:queued"]}]
    st["conflict_after_merge"] = {"101": [103]}
    st = run(st)
    assert st.get("merged") == [101], st["_summary"]
    assert labels(st, 103) == ["agent:changes-requested"]
    assert any("leaves the merge queue" in b for b in bodies(st, 103))


@test
def draft_leaves_the_queue():
    st = run(make_state({101: {"head": sha(0xa1), "draft": True, "comments": [approval(sha(0xa1)), queued()]}}),
             script="integrate.sh", args=["101"])
    assert labels(st, 101) == [] and st["_stdout"].strip().endswith("result=left")


@test
def removed_label_and_closed_pr_are_left_alone():
    st = run(make_state({101: {"head": sha(0xa1), "labels": [], "comments": [approval(sha(0xa1)), queued()]}}),
             script="integrate.sh", args=["101"])
    assert st["_stdout"].strip() == "result=left" and labels(st, 101) == []
    st = run(make_state({101: {"head": sha(0xa1), "state": "CLOSED", "comments": [approval(sha(0xa1)), queued()]}}),
             script="integrate.sh", args=["101"])
    assert st["_stdout"].strip() == "result=left"


@test
def human_merge_during_checks_means_update_again_then_merge():
    st = run(make_state({101: {"head": sha(0xa1), "comments": [approval(sha(0xa1)), queued()]}}, bump_base_on_checks=1))
    assert st.get("merged") == [101] and len(updates_of(st, 101)) == 1
    assert st["merge_audit"][0]["up_to_date"]


@test
def base_that_keeps_moving_requeues_instead_of_looping():
    st = run(make_state({101: {"head": sha(0xa1), "comments": [approval(sha(0xa1)), queued()]}}, bump_base_on_checks=9))
    assert labels(st, 101) == ["agent:queued"] and "kept moving" in bodies(st, 101)[-1]


@test
def base_with_workflow_changes_cant_be_merged_in_and_goes_to_the_implementor():
    st = run(make_state({101: {"head": sha(0xa1), "bv": 0, "comments": [approval(sha(0xa1)), queued()]}},
                        base_version=1, workflow_version=1))
    assert labels(st, 101) == ["agent:changes-requested"] and "workflow files" in bodies(st, 101)[-1]


@test
def someone_pushes_while_the_checks_run():
    st = make_state({101: {"head": sha(0xa1), "comments": [approval(sha(0xa1)), queued()]}})
    st["hooks"] = [{"match": "pr checks 101", "pr": 101, "push": sha(0xa9)}]
    st = run(st)
    assert not st.get("merged") and st["items"]["101"]["head"] == sha(0xa9)
    assert "#101: left" in st["_summary"], st["_summary"]
    assert not any("integration-failed" in b for b in bodies(st, 101))   # not a failed attempt


@test
def unexpected_api_error_requeues_once():
    # Regression: the ERR trap ran inside $(...) and the main shell carried on with its output.
    st = make_state({101: {"head": sha(0xa1), "comments": [approval(sha(0xa1)), queued()]}})
    st["fail_cmds"] = ["compare/" + sha(0xa1) + "...sandbox"]
    st = run(st)
    assert labels(st, 101) == ["agent:queued"]
    assert sum("integration-failed" in b for b in bodies(st, 101)) == 1
    assert "integer expression" not in st["_stderr"]


@test
def qa_hold_times_out_and_the_queue_moves_on():
    st = run(two_queued(), AGENT_QA_ON_BASE_UPDATE="true", AGENT_INTEGRATOR_QA_MINUTES=0)
    assert st.get("merged") == [101] and labels(st, 102) == ["agent:qa"]
    assert any("agent:integrator-hold" in b for b in bodies(st, 102))


@test
def qa_hold_continues_when_qa_passes():
    st = two_queued()
    # QA (another run) passes while the queue holds; the merge gate hands the PR back as agent:integrating
    st["hooks"] = [{"match": "pr view 102", "pr": 102, "if_label": "agent:qa", "labels": ["agent:integrating"], "approve_head": True}]
    st = run(st, AGENT_QA_ON_BASE_UPDATE="true")
    assert st.get("merged") == [101, 102], st["_stderr"][-2000:]


@test
def drain_budget_hands_the_rest_to_a_fresh_run():
    st = make_state({n: {"head": sha(0x100 + n), "comments": [approval(sha(0x100 + n)), queued()]} for n in (101, 102, 103)})
    st = run(st, DRAIN_MINUTES=0)
    assert not st.get("merged") and "handed #101" in st["_summary"] and ["labeled", "101", "agent:queued"] in st["events"]


# --- same own changes, and the guard -----------------------------------------------------------
def own_changes_state():
    appr, res1, res2 = sha(0xa1), sha(0xa2), sha(0xa3)
    st = make_state({101: {"head": res1, "labels": [], "comments": [approval(appr)],
                           "extra_shas": {appr: {"base_version": 0, "files": files("-old", "+new"), "commit": {}},
                                          res2: {"base_version": 1, "files": files("-old", "+new", "+extra"), "commit": {}}}}})
    st["shas"][res1]["files"] = [dict(files("-old", "+new")[0], patch="@@ -5,3 +5,3 @@\n other ctx\n-old\n+new")]
    return st, appr, res1, res2


@test
def same_own_changes_ignores_context_and_catches_new_edits():
    st0, appr, res1, res2 = own_changes_state()
    st = run(st0, script="same-own-changes.sh", args=["101", res1])
    assert st["_rc"] == 0 and st["_stdout"].strip() == appr
    out = os.path.join(tempfile.mkdtemp(), "i.diff")
    st = run(st0, script="same-own-changes.sh", args=["101", res2, out])
    assert st["_rc"] == 1 and "+extra" in open(out).read()
    st0["shas"][res1]["files"] = [{"filename": "img.png", "status": "modified", "changes": 0}]
    assert run(st0, script="same-own-changes.sh", args=["101", res1])["_rc"] == 1   # binary: can't compare


@test
def pr_still_current_in_the_queue():
    st = run(make_state({101: {"head": sha(0xa1), "comments": [approval(sha(0xa1))]}}), script="pr-still-current.sh", args=["101", sha(0xa1)])
    assert "skip=PR is in the merge queue" in st["_stdout"]
    st = run(make_state({101: {"head": sha(0xa2), "comments": [approval(sha(0xa1))]}}), script="pr-still-current.sh", args=["101", sha(0xa2)])
    assert st["_stdout"].strip() == "" and labels(st, 101) == []   # someone else's push: out of the queue, reviewed


@test
def reviewer_skips_review_when_own_edits_are_unchanged():
    st0, appr, res1, _ = own_changes_state()
    guard = subst(steps("agent-reviewer.yml", "review")["Loop guard"]["run"],
                  {"github.event.action": "synchronize", "github.event.pull_request.head.sha": res1})
    st = run(st0, shell=guard, PR=101, QA="true", QA_ON_BASE_UPDATE="", SKIP_SAME="true", MAX_ROUNDS=3)
    assert st["_rc"] == 0 and st["_outputs"].get("stop") == "true" and labels(st, 101) == ["agent:approved"], st["_stderr"]
    assert "agent:approved-sha %s" % res1 in bodies(st, 101)[-1]
    st = run(st0, shell=guard, PR=101, QA="true", QA_ON_BASE_UPDATE="", SKIP_SAME="", MAX_ROUNDS=3)
    assert st["_outputs"].get("stop") != "true"   # without the variable: a full review


@test
def reviewer_gets_the_interdiff_when_own_edits_changed():
    st0, appr, _, res2 = own_changes_state()
    st0["items"]["101"]["head"] = res2
    guard = subst(steps("agent-reviewer.yml", "review")["Loop guard"]["run"],
                  {"github.event.action": "synchronize", "github.event.pull_request.head.sha": res2})
    st = run(st0, shell=guard, PR=101, QA="true", QA_ON_BASE_UPDATE="", SKIP_SAME="true", MAX_ROUNDS=3)
    assert st["_outputs"].get("interdiff") == ".agent-out/interdiff.diff" and st["_outputs"].get("approved") == appr


@test
def reviewer_skips_a_push_of_an_already_approved_commit():
    # Regression: with the QA hold, the Integrator's update reached the Reviewer after the PR moved to agent:qa.
    st0 = make_state({101: {"head": sha(0xa2), "labels": ["agent:qa"], "comments": [approval(sha(0xa2))]}})
    guard = subst(steps("agent-reviewer.yml", "review")["Loop guard"]["run"],
                  {"github.event.action": "synchronize", "github.event.pull_request.head.sha": sha(0xa2)})
    st = run(st0, shell=guard, PR=101, QA="true", QA_ON_BASE_UPDATE="true", SKIP_SAME="", MAX_ROUNDS=3)
    assert st["_outputs"].get("stop") == "true" and labels(st, 101) == ["agent:qa"]


# --- merge gate --------------------------------------------------------------------------------
@test
def merge_gate_queues_with_position_and_records_human_approvals():
    join = steps("agent-merge.yml", "merge")["Join the merge queue"]["run"]
    st0 = make_state({104: {"head": sha(0xd1), "comments": [queued()]}, 101: {"head": sha(0xa1), "labels": ["agent:approved"]}})
    st = run(st0, shell=join, PR=101, HEAD_SHA=sha(0xa1), SENDER_TYPE="User", SENDER="human", BASE="sandbox")
    assert labels(st, 101) == ["agent:queued"]
    b = bodies(st, 101)[-1]
    assert "position 2" in b and "<!-- agent:queued -->" in b and "agent:approved-sha %s" % sha(0xa1) in b


@test
def merge_gate_hands_a_held_pr_back_to_the_integrator():
    join = steps("agent-merge.yml", "merge")["Join the merge queue"]["run"]
    st0 = make_state({101: {"head": sha(0xa1), "labels": ["agent:approved"],
                            "comments": [bot_comment("<!-- agent:integrator-hold %s -->" % sha(0xa1))]}})
    st = run(st0, shell=join, PR=101, HEAD_SHA=sha(0xa1), SENDER_TYPE="Bot", SENDER="bot", BASE="sandbox")
    assert labels(st, 101) == ["agent:integrating"] and len(bodies(st, 101)) == 1


# --- watchdog ----------------------------------------------------------------------------------
@test
def watchdog_restarts_an_idle_queue_and_leaves_a_busy_one_alone():
    st0 = make_state({104: {"head": sha(0xd1), "comments": [queued()]}, 105: {"head": sha(0xe1), "comments": [queued()]}})
    st = run(st0, script="watchdog.sh", AGENT_AUTO_MERGE="true", AGENT_WATCHDOG_MINUTES=10)
    assert ["labeled", "104", "agent:queued"] in st["events"] and "restarting it at #104" in st["_stdout"]
    st0["active_runs"] = [{"workflow": "agent-integrator.yml", "status": "in_progress", "name": "Agent · Integrator", "displayTitle": "T104"}]
    st = run(st0, script="watchdog.sh", AGENT_AUTO_MERGE="true", AGENT_WATCHDOG_MINUTES=10)
    assert not st["events"] and "an Integrator run is active" in st["_stdout"]
    st = run(make_state({104: {"head": sha(0xd1), "comments": [queued()]}}), script="watchdog.sh", AGENT_AUTO_MERGE="", AGENT_WATCHDOG_MINUTES=10)
    assert not st["events"]   # merging switched off: queued PRs wait quietly


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else ""
    failed = 0
    for t in TESTS:
        if only not in t.__name__:
            continue
        try:
            t()
            print("PASS", t.__name__)
        except Exception:
            failed += 1
            print("FAIL", t.__name__)
            traceback.print_exc(limit=3)
    print("\n%d failed" % failed)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
