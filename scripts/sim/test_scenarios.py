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
def required_check_that_never_reports_goes_straight_to_a_human():
    # Found by the matrix: retrying a misconfigured AGENT_REQUIRED_CHECKS cost ~38 reviews and 60 Lead runs per PR.
    st = run(make_state({101: {"head": sha(0xa1), "comments": [approval(sha(0xa1)), queued()]}}, checks={sha(0xa1): "none"}))
    assert labels(st, 101) == ["agent:needs-human"] and "AGENT_REQUIRED_CHECKS" in bodies(st, 101)[-1]


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
def the_sweep_leaves_a_pr_alone_while_the_implementor_works_on_it():
    # Found in the live test (#134): a second merge flagged the PR again while the Implementor was
    # already resolving the first conflict (its first step removes agent:changes-requested). The
    # second run found nothing to do and went to the Lead.
    st = make_state({
        101: {"head": sha(0xa1), "comments": [approval(sha(0xa1)), queued()]},
        103: {"head": sha(0xc1), "labels": [], "branch": "agent/issue-3"},
    })
    st["conflict_after_merge"] = {"101": [103]}
    st["active_runs"] = [{"workflow": "agent-implementor.yml", "status": "in_progress", "name": "Agent · Implementor", "displayTitle": "T103"}]
    st = run(st)
    assert st.get("merged") == [101] and labels(st, 103) == [] and not bodies(st, 103), (labels(st, 103), bodies(st, 103))
    # The run can also start while the sweep is busy with other PRs (found by the matrix): it is
    # checked right before flagging, not once up front.
    st2 = make_state({
        101: {"head": sha(0xa1), "comments": [approval(sha(0xa1)), queued()]},
        102: {"head": sha(0xb1), "labels": [], "branch": "agent/issue-2"},
        103: {"head": sha(0xc1), "labels": [], "branch": "agent/issue-3"},
    })
    st2["conflict_after_merge"] = {"101": [102, 103]}
    st2["hooks"] = [{"match": "pr view 102 -R o/r --json mergeable", "pr": 103, "labels": []}]
    st2["run_hooks"] = {"pr view 102 -R o/r --json mergeable": [{"workflow": "agent-implementor.yml", "status": "in_progress", "name": "Agent · Implementor", "displayTitle": "T103"}]}
    st2 = run(st2)
    assert labels(st2, 102) == ["agent:changes-requested"] and labels(st2, 103) == [], (labels(st2, 102), labels(st2, 103))
    st["active_runs"] = []   # without a run working on it, it is flagged as before
    st["items"]["103"]["conflict"] = True
    st = run(st, script="sweep-conflicts.sh", args=["101", "sandbox"])
    assert labels(st, 103) == ["agent:changes-requested"]


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
def pr_turned_into_a_draft_while_merging_leaves_the_queue():
    # Found by the matrix: the merge must not happen, and it's not a failed attempt.
    st = make_state({101: {"head": sha(0xa1), "comments": [approval(sha(0xa1)), queued()]}})
    st["hooks"] = [{"match": "pr checks 101", "pr": 101, "draft": True}]
    st = run(st)
    assert not st.get("merged") and labels(st, 101) == [], (labels(st, 101), st["_stderr"][-800:])
    assert not any("integration-failed" in b for b in bodies(st, 101)) and "draft" in bodies(st, 101)[-1]
    st = make_state({101: {"head": sha(0xa1), "comments": [approval(sha(0xa1)), queued()]}})
    st["hooks"] = [{"match": "pr merge 101", "pr": 101, "draft": True}]   # right before the merge call
    st = run(st)
    assert not st.get("merged") and labels(st, 101) == [] and not st.get("violations")


@test
def an_api_error_right_after_the_merge_still_ends_done():
    # Found by the matrix: the error handler requeued the merged PR (or handed it to the Lead).
    st = make_state({101: {"head": sha(0xa1), "issue": 11, "comments": [approval(sha(0xa1)), queued()]}})
    st["fail_cmds"] = ["issues/101/labels -f labels[]=agent:done"]
    st = run(st)
    assert st.get("merged") == [101] and labels(st, 101) == ["agent:done"], labels(st, 101)
    assert not any("integration-failed" in b for b in bodies(st, 101))


@test
def queue_labels_on_closed_prs_are_tidied():
    # Found by the matrix: an Integrator run killed right after a merge, or a late approval.
    st = make_state({
        101: {"head": sha(0xa1), "state": "MERGED", "labels": ["agent:integrating"]},
        102: {"head": sha(0xb1), "state": "MERGED", "labels": ["agent:queued"]},
        103: {"head": sha(0xc1), "state": "CLOSED", "labels": ["agent:approved"]},
        104: {"head": sha(0xd1), "labels": ["agent:queued"]},
    })
    st = run(st, script="queue-tidy.sh")
    assert labels(st, 101) == labels(st, 102) == ["agent:done"] and labels(st, 103) == [] and labels(st, 104) == ["agent:queued"]


@test
def merge_gate_ignores_a_late_approval_of_a_merged_pr():
    risk = steps("agent-merge.yml", "merge")["Risk gate"]["run"]
    st0 = make_state({101: {"head": sha(0xa1), "state": "MERGED", "labels": ["agent:done", "agent:approved"]}})
    st = run(st0, shell=risk, PR=101, HEAD_SHA=sha(0xa1), SENDER_TYPE="User", SENDER="human", PROTECTED=".github/")
    assert st["_outputs"].get("stop") == "true" and "agent:queued" not in labels(st, 101)


@test
def a_human_merge_right_before_the_merge_is_the_documented_race():
    # GitHub's merge API doesn't check freshness without a branch rule, so a human merging by hand
    # between the Integrator's last check and its merge lands an untested combination. Documented
    # limitation (README: make the queue a hard rule with a ruleset); the audit names it.
    st = make_state({101: {"head": sha(0xa1), "comments": [approval(sha(0xa1)), queued()]}})
    st["hooks"] = [{"match": "pr merge 101", "pr": 101, "human_merge": True}]
    st = run(st)
    assert st.get("merged") == [101]
    assert [v["kind"] for v in st["violations"]] == ["human-merge-race"]


@test
def base_with_workflow_changes_goes_straight_to_a_human():
    # Found by the matrix: the Implementor can't push workflow changes either, so sending it there cost
    # ~4 Lead runs per PR before a human was asked anyway.
    st = run(make_state({101: {"head": sha(0xa1), "bv": 0, "comments": [approval(sha(0xa1)), queued()]}},
                        base_version=1, workflow_version=1))
    assert labels(st, 101) == ["agent:needs-human"] and "workflow files" in bodies(st, 101)[-1], (labels(st, 101), bodies(st, 101)[-1])
    assert "refusing to allow a GitHub App" in bodies(st, 101)[-1]   # the exact error is passed on
    # a real conflict still goes to the Implementor
    st = run(make_state({101: {"head": sha(0xa1), "bv": 0, "conflict": True, "comments": [approval(sha(0xa1)), queued()]}}, base_version=1))
    assert labels(st, 101) == ["agent:changes-requested"]


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


# --- QA once, at the front of the queue (AGENT_QA_IN_QUEUE, the default with QA on) --------------
def qa_passes(n):
    """QA (another run) passes while the queue holds: the merge gate hands the PR back as agent:integrating."""
    return {"match": "pr view %d" % n, "pr": n, "if_label": "agent:qa", "labels": ["agent:integrating"], "approve_head": True}


def holds(st, n):
    return [b for b in bodies(st, n) if "<!-- agent:integrator-hold" in b]


@test
def qa_in_queue_tests_the_combined_commit_once_after_the_checks():
    st = make_state({
        101: {"head": sha(0xa1), "issue": 11, "comments": [approval(sha(0xa1), "reviewer"), queued()]},
        102: {"head": sha(0xb1), "issue": 12, "comments": [approval(sha(0xb1), "reviewer"), queued()]},
    })
    st["hooks"] = [qa_passes(101), qa_passes(102)]
    st = run(st, AGENT_QA_IN_QUEUE="true")
    assert st.get("merged") == [101, 102], st["_stderr"][-2000:]
    assert len(holds(st, 101)) == len(holds(st, 102)) == 1
    head102 = st["items"]["102"]["head"]
    assert head102 != sha(0xb1) and "integrator-hold %s" % head102 in holds(st, 102)[0]   # QA tested the updated commit
    assert "required checks passed" in holds(st, 102)[0]
    assert all(a["qa_tested"] for a in st["merge_audit"]), st["merge_audit"]
    assert not st.get("violations")


@test
def qa_in_queue_skips_changes_qa_already_passed():
    # QA passed 0xb1 (e.g. the Lead sent it to QA, or before an update): the update keeps its own changes.
    st = run(two_queued(), AGENT_QA_IN_QUEUE="true")
    assert st.get("merged") == [101, 102] and not holds(st, 101) and not holds(st, 102)
    assert all(a["qa_tested"] for a in st["merge_audit"])


@test
def qa_in_queue_tests_again_only_when_own_changes_changed():
    old, new = sha(0xa1), sha(0xa2)
    st = make_state({101: {"head": new, "comments": [approval(old), approval(new, "reviewer"), queued()],
                           "extra_shas": {old: {"base_version": 0, "files": files("+v1"), "commit": {}}}}})
    st["shas"][new]["files"] = files("+v2")
    st["hooks"] = [qa_passes(101)]
    st = run(st, AGENT_QA_IN_QUEUE="true")
    assert st.get("merged") == [101] and len(holds(st, 101)) == 1


@test
def qa_failing_at_the_front_frees_the_queue():
    st = make_state({
        101: {"head": sha(0xa1), "comments": [approval(sha(0xa1), "reviewer"), queued()]},
        102: {"head": sha(0xb1), "comments": [approval(sha(0xb1), "reviewer"), queued()]},
    })
    st["hooks"] = [{"match": "pr view 101", "pr": 101, "if_label": "agent:qa", "labels": ["agent:changes-requested"]}, qa_passes(102)]
    st = run(st, AGENT_QA_IN_QUEUE="true")
    assert st.get("merged") == [102] and labels(st, 101) == ["agent:changes-requested"]
    assert not any("integration-failed" in b for b in bodies(st, 101))   # a QA defect isn't a failed merge attempt


@test
def qa_in_queue_respects_lead_and_human_approvals():
    fail = bot_comment("<!-- agent:qa -->\n**Verdict:** fail")
    for over in (approval(sha(0xa1), "lead"), bot_comment("<!-- agent:queued -->\n<!-- agent:approved-sha %s -->" % sha(0xa1))):
        st = run(make_state({101: {"head": sha(0xa1), "comments": [approval(sha(0xa1), "reviewer"), fail, over, queued()]}}),
                 AGENT_QA_IN_QUEUE="true")
        assert st.get("merged") == [101] and not holds(st, 101), st["_stderr"][-1500:]
    # a failed QA report after the approval: QA again
    st = make_state({101: {"head": sha(0xa1), "comments": [approval(sha(0xa1)), fail, queued()]}})
    st["hooks"] = [qa_passes(101)]
    st = run(st, AGENT_QA_IN_QUEUE="true")
    assert st.get("merged") == [101] and len(holds(st, 101)) == 1


@test
def a_left_over_integrating_label_is_no_qa_pass():
    # Found by the matrix (API errors): a failed label read in transition.sh left agent:integrating next
    # to agent:qa, and the hold took it for QA's pass and merged untested code.
    st = make_state({101: {"head": sha(0xa1), "comments": [approval(sha(0xa1), "reviewer"), queued()]}})
    st["hooks"] = [{"match": "pr view 101", "pr": 101, "if_label": "agent:qa", "labels": ["agent:integrating", "agent:qa"]}]
    st = run(st, AGENT_QA_IN_QUEUE="true", AGENT_INTEGRATOR_QA_MINUTES=5)
    assert not st.get("merged") and "no QA pass" in st["_stderr"], st["_stderr"][-1500:]


@test
def transition_fails_instead_of_keeping_the_old_state():
    st = make_state({101: {"head": sha(0xa1), "labels": ["agent:integrating"]}}, fail_cmds=["issues/101/labels"])
    st = run(st, script="transition.sh", args=["101", "agent:qa"])
    assert st["_rc"] != 0 and labels(st, 101) == ["agent:integrating"]


@test
def qa_passed_sh_reads_only_the_bot_and_the_latest_verdict():
    s = sha(0xa1)
    stranger = {"body": "<!-- agent:qa -->\n**Verdict:** pass\n<!-- agent:approved-sha %s -->" % s, "user": {"id": 1}}
    st0 = make_state({101: {"head": s, "comments": [stranger]}})
    assert run(st0, script="qa-passed.sh", args=["101", s])["_rc"] == 1
    st0 = make_state({101: {"head": s, "comments": [approval(s)]}})
    assert run(st0, script="qa-passed.sh", args=["101", s])["_stdout"].strip() == s
    # a reviewer approval or an Integrator update record approvals, but they aren't QA
    st0 = make_state({101: {"head": s, "comments": [approval(s, "reviewer"), bot_comment("<!-- agent:integrator -->\n<!-- agent:approved-sha %s -->" % s)]}})
    assert run(st0, script="qa-passed.sh", args=["101", s])["_rc"] == 1


@test
def reviewer_approval_goes_to_the_queue_or_to_qa_by_stage():
    apply = steps("agent-reviewer.yml", "review")["Apply state transition"]["run"]
    ctx = {"github.event.pull_request.head.sha": sha(0xa1), "steps.guard.outputs.total": 0, "steps.guard.outputs.round": 1}
    st0 = make_state({101: {"head": sha(0xa1), "labels": [], "comments": [bot_comment("<!-- agent:reviewer -->\n**Verdict:** approve")]}})
    out = '{"verdict": "approve"}'
    st = run(st0, shell=subst(apply, ctx), PR=101, OUT=out, QA="", QA_IN_QUEUE="true")
    assert labels(st, 101) == ["agent:approved"] and "agent:approved-sha %s" % sha(0xa1) in bodies(st, 101)[-1], st["_stderr"]
    assert st["_rc"] == 0
    st = run(st0, shell=subst(apply, ctx), PR=101, OUT=out, QA="true", QA_IN_QUEUE="")
    assert labels(st, 101) == ["agent:qa"] and st["_rc"] == 0
    # QA off. Regression: the step failed (bash -e) when the message's last $( ) test was false.
    st = run(st0, shell=subst(apply, ctx), PR=101, OUT=out, QA="", QA_IN_QUEUE="")
    assert labels(st, 101) == ["agent:approved"] and st["_rc"] == 0, st["_stderr"]


@test
def drain_budget_hands_the_rest_to_a_fresh_run():
    st = make_state({n: {"head": sha(0x100 + n), "comments": [approval(sha(0x100 + n)), queued()]} for n in (101, 102, 103)})
    st = run(st, DRAIN_MINUTES=0)
    assert not st.get("merged") and "handed #101" in st["_summary"] and ["labeled", "101", "agent:queued"] in st["events"]


@test
def risk_raised_after_approval_stops_the_merge():
    st = make_state({101: {"head": sha(0xa1), "issue": 11, "comments": [approval(sha(0xa1)), queued()]}})
    st["items"]["11"]["labels"].append("risk:high")
    st = run(st)
    assert not st.get("merged") and labels(st, 101) == ["agent:needs-human"] and "high risk" in bodies(st, 101)[-1]
    st = make_state({101: {"head": sha(0xa1), "issue": 11, "comments": [approval(sha(0xa1)), queued()]}})
    st["items"]["11"]["labels"].append("risk:high")
    assert run(st, AGENT_AUTO_MERGE_HIGH_RISK="true").get("merged") == [101]   # allowed explicitly


@test
def app_token_is_reused_while_young_and_renewed_before_it_expires():
    import base64, json as js, subprocess as sp
    d = tempfile.mkdtemp()
    key, pub, cache, curl_log = (os.path.join(d, x) for x in ("key.pem", "pub.pem", "cache", "curl.log"))
    sp.run(["openssl", "genrsa", "-out", key, "2048"], check=True, capture_output=True)
    sp.run(["openssl", "rsa", "-in", key, "-pubout", "-out", pub], check=True, capture_output=True)
    env = dict(AGENT_APP_ID="123", AGENT_APP_PRIVATE_KEY=open(key).read(), AGENT_TOKEN_CACHE=cache, FAKE_CURL_LOG=curl_log)
    tok = lambda: run(make_state({}), script="app-token.sh", FAKE_DATE_FILE="", **env)["_stdout"]
    open(cache, "w").write("%d ghs_start\n" % (__import__("time").time() - 60))
    assert tok() == "ghs_start" and not os.path.exists(curl_log)          # young: reused, no API call
    open(cache, "w").write("%d ghs_start\n" % (__import__("time").time() - 3000))
    assert tok() == "ghs_fresh2"                                           # 50 minutes old: renewed
    assert tok() == "ghs_fresh2"                                           # and the new one is cached
    reqs = [js.loads(l) for l in open(curl_log)]
    assert [r["url"].split("/")[-1] for r in reqs] == ["installation", "access_tokens"]
    assert js.loads(reqs[1]["body"]) == {"repositories": ["r"]}            # only this repository
    jwt = reqs[0]["auth"].split("Bearer ")[1]
    h, p_, sig = jwt.split(".")
    pad = lambda x: x + "=" * (-len(x) % 4)
    claims = js.loads(base64.urlsafe_b64decode(pad(p_)))
    assert claims["iss"] == "123" and claims["exp"] - claims["iat"] <= 600
    open(os.path.join(d, "sig"), "wb").write(base64.urlsafe_b64decode(pad(sig)))
    ok = sp.run(["openssl", "dgst", "-sha256", "-verify", pub, "-signature", os.path.join(d, "sig")],
                input=("%s.%s" % (h, p_)).encode(), capture_output=True)
    assert ok.returncode == 0, ok.stdout + ok.stderr                      # signed with the App's key
    assert run(make_state({}), script="app-token.sh", GH_TOKEN="ghs_env")["_stdout"] == "ghs_env"   # no key: unchanged


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


# --- monorepos: path-scoped required checks and QA ------------------------------------------------
def pr_with(name, **extra):
    return make_state({101: {"head": sha(0xa1), "files": files("+x", name=name),
                             "comments": [approval(sha(0xa1), "reviewer"), queued()]}}, **extra)


@test
def pr_paths_picks_the_checks_and_scopes_that_apply():
    req = "Backend CI@backend/|shared/, Frontend CI@web/, Lint"
    out = lambda name, *a, **e: run(pr_with(name), script="pr-paths.sh", args=list(a), **e)
    assert out("backend/api.py", "required", "101", AGENT_REQUIRED_CHECKS=req)["_stdout"].split("\n")[:2] == ["Backend CI", "Lint"]
    assert out("shared/t.ts", "required", "101", AGENT_REQUIRED_CHECKS=req)["_stdout"].split("\n")[:2] == ["Backend CI", "Lint"]
    r = out("README.md", "required", "101", AGENT_REQUIRED_CHECKS="Backend CI@backend/")
    assert r["_stdout"].strip() == "" and r["_rc"] == 0
    assert out("backend/a.py", "required", "101", AGENT_REQUIRED_CHECKS="Backend CI@backend/, Frontend CI@web/")["_rc"] == 0
    assert out("web/a.ts", "touches", "101", "web/|mobile/")["_rc"] == 0
    assert out("backend/a.py", "touches", "101", "web/")["_rc"] == 1
    assert out("backend/a.py", "touches", "101", "")["_rc"] == 0             # no paths: everything
    st = run(pr_with("backend/a.py", fail_cmds=["pulls/101/files"]), script="pr-paths.sh", args=["touches", "101", "web/"])
    assert st["_rc"] == 3                                                     # an error is never a "no"
    st = run(pr_with("backend/a.py", fail_cmds=["pulls/101/files"]), script="pr-paths.sh", args=["required", "101"],
             AGENT_REQUIRED_CHECKS="Backend CI@backend/")
    assert st["_rc"] != 0 and st["_stdout"].strip() == ""                     # never drops a check silently


@test
def the_queue_waits_only_for_the_checks_that_apply():
    req = "Backend CI@backend/, Frontend CI@web/"
    # Frontend CI never reports on a backend-only PR (path-filtered workflow): not waited for.
    st = run(pr_with("backend/api.py", checks={sha(0xa1): "pass"}, workflows=["Backend CI"]), AGENT_REQUIRED_CHECKS=req)
    assert st.get("merged") == [101], st["_stderr"][-1500:]
    st = run(pr_with("backend/api.py", checks={sha(0xa1): "fail"}, workflows=["Backend CI"]), AGENT_REQUIRED_CHECKS=req)
    assert not st.get("merged") and labels(st, 101) == ["agent:changes-requested"]   # and a red one still counts
    # A docs-only PR: no check applies, it merges without waiting.
    st = run(pr_with("docs/readme.md", checks={sha(0xa1): "none"}), AGENT_REQUIRED_CHECKS=req)
    assert st.get("merged") == [101] and "no required check applies" in st["_stderr"]
    # An unscoped check still applies to everything: never reporting still goes to a human.
    st = run(pr_with("docs/readme.md", checks={sha(0xa1): "none"}), AGENT_REQUIRED_CHECKS=req + ", CI")
    assert not st.get("merged") and labels(st, 101) == ["agent:needs-human"]


@test
def qa_in_the_queue_only_for_prs_that_change_qa_paths():
    st = pr_with("backend/api.py", audit_qa=False)   # no QA: the audit's QA rule doesn't apply
    st = run(st, AGENT_QA_IN_QUEUE="true", AGENT_QA_PATHS="web/")
    assert st.get("merged") == [101] and not holds(st, 101) and "AGENT_QA_PATHS" in st["_stderr"]
    st = pr_with("web/board.tsx")
    st["hooks"] = [qa_passes(101)]
    st = run(st, AGENT_QA_IN_QUEUE="true", AGENT_QA_PATHS="web/|packages/ui/")
    assert st.get("merged") == [101] and len(holds(st, 101)) == 1


@test
def merge_method_and_production_link_are_configurable():
    one = lambda: make_state({101: {"head": sha(0xa1), "issue": 11, "comments": [approval(sha(0xa1)), queued()]}})
    st = run(one())
    assert any(l.startswith("pr merge 101") and "--squash" in l for l in st["log"])   # the default
    assert "https://o.github.io/r/" in "\n".join(bodies(st, 11))
    st = run(one(), AGENT_MERGE_METHOD="rebase", AGENT_PRODUCTION_URL="https://app.example/{repo}/")
    assert st.get("merged") == [101] and any(l.startswith("pr merge 101") and "--rebase" in l for l in st["log"])
    assert "[production](https://app.example/r/)" in "\n".join(bodies(st, 11))
    st = run(one(), AGENT_MERGE_METHOD="fast", AGENT_PRODUCTION_URL="none")   # a typo falls back to squash
    assert st.get("merged") == [101] and any(l.startswith("pr merge 101") and "--squash" in l for l in st["log"])
    assert "production" not in "\n".join(bodies(st, 11)) and "AGENT_MERGE_METHOD" in st["_stderr"]


@test
def a_pr_the_implementor_is_fixing_is_left_alone_and_restarted_if_its_run_died():
    # agent:fixing: the sweep doesn't flag the PR again (no second Implementor run).
    st = make_state({101: {"head": sha(0xa1), "comments": [approval(sha(0xa1)), queued()]},
                     103: {"head": sha(0xc1), "labels": ["agent:fixing"], "branch": "agent/issue-3"}})
    st["conflict_after_merge"] = {"101": [103]}
    st = run(st)
    assert st.get("merged") == [101] and labels(st, 103) == ["agent:fixing"] and not bodies(st, 103)
    # The run died (no agent run active, the label is old): the watchdog restarts the Implementor.
    st0 = make_state({103: {"head": sha(0xc1), "labels": ["agent:fixing"], "branch": "agent/issue-3",
                            "label_at": {"agent:fixing": "2020-01-01T00:00:00Z"}}})
    st = run(st0, script="watchdog.sh", AGENT_WATCHDOG_MINUTES=10)
    assert labels(st, 103) == ["agent:changes-requested"] and "Restarting the Implementor" in bodies(st, 103)[-1], st["_stdout"]
    st0["active_runs"] = [{"workflow": "agent-implementor.yml", "status": "in_progress", "name": "Agent · Implementor", "displayTitle": "T103"}]
    assert labels(run(st0, script="watchdog.sh", AGENT_WATCHDOG_MINUTES=10), 103) == ["agent:fixing"]   # still working


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
