import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addTask, completeTask, removeTask, listTasks, formatTask, load } from "../src/tasks.js";
import { run } from "../bin/tasks.js";

test("addTask assigns incrementing ids and trims titles", () => {
  let tasks = addTask([], "  first  ");
  tasks = addTask(tasks, "second");
  assert.deepEqual(tasks.map((t) => [t.id, t.title, t.done]), [
    [1, "first", false],
    [2, "second", false],
  ]);
});

test("addTask rejects empty titles", () => {
  assert.throws(() => addTask([], "   "), /must not be empty/);
});

test("completeTask marks only the given task as done", () => {
  const tasks = completeTask(addTask(addTask([], "a"), "b"), 1);
  assert.deepEqual(tasks.map((t) => t.done), [true, false]);
});

test("completeTask throws for unknown ids", () => {
  assert.throws(() => completeTask([], 42), /not found/);
});

test("removeTask removes only the given task and keeps other ids", () => {
  const tasks = addTask(addTask(addTask([], "a"), "b"), "c");
  assert.deepEqual(removeTask(tasks, 2).map((t) => t.id), [1, 3]);
});

test("removeTask works for done and open tasks", () => {
  const tasks = completeTask(addTask(addTask([], "a"), "b"), 1);
  assert.deepEqual(removeTask(tasks, 1).map((t) => t.id), [2]);
  assert.deepEqual(removeTask(tasks, 2).map((t) => t.id), [1]);
});

test("removeTask does not mutate its input", () => {
  const tasks = addTask(addTask([], "a"), "b");
  const snapshot = JSON.stringify(tasks);
  const result = removeTask(tasks, 1);
  assert.notEqual(result, tasks);
  assert.equal(JSON.stringify(tasks), snapshot);
});

test("removeTask throws for unknown ids", () => {
  assert.throws(() => removeTask([], 9), /Task 9 not found/);
});

test("CLI remove deletes the task and reports it", () => {
  const file = join(mkdtempSync(join(tmpdir(), "tasks-")), "tasks.json");
  const lines = [];
  const out = (s) => lines.push(s);

  run(["add", "a"], { file, out });
  run(["add", "b"], { file, out });
  assert.equal(run(["remove", "1"], { file, out }), 0);

  assert.equal(lines.at(-1), "Removed task 1");
  assert.deepEqual(load(file).map((t) => t.id), [2]);
});

test("CLI remove fails for unknown ids and leaves the file unchanged", () => {
  const file = join(mkdtempSync(join(tmpdir(), "tasks-")), "tasks.json");
  const out = () => {};

  run(["add", "a"], { file, out });
  const before = readFileSync(file, "utf8");
  assert.throws(() => run(["remove", "9"], { file, out }), /Task 9 not found/);
  assert.equal(readFileSync(file, "utf8"), before);
});

test("CLI remove requires an integer id", () => {
  const file = join(mkdtempSync(join(tmpdir(), "tasks-")), "tasks.json");
  const out = () => {};
  assert.throws(() => run(["remove"], { file, out }), /Usage: tasks remove <id>/);
  assert.throws(() => run(["remove", "abc"], { file, out }), /Usage: tasks remove <id>/);
});

test("listTasks hides done tasks unless all is set", () => {
  const tasks = completeTask(addTask(addTask([], "a"), "b"), 1);
  assert.equal(listTasks(tasks).length, 1);
  assert.equal(listTasks(tasks, { all: true }).length, 2);
});

test("formatTask shows a checkbox, id and title", () => {
  assert.equal(formatTask({ id: 3, title: "x", done: true }), "[x] 3. x");
});

test("CLI add, done and list round-trip through the file", () => {
  const file = join(mkdtempSync(join(tmpdir(), "tasks-")), "tasks.json");
  const lines = [];
  const out = (s) => lines.push(s);

  run(["add", "write", "tests"], { file, out });
  run(["done", "1"], { file, out });
  run(["list", "--all"], { file, out });

  assert.equal(load(file)[0].done, true);
  assert.equal(lines.at(-1), "[x] 1. write tests");
});
