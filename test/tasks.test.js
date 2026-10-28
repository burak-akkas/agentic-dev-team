import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addTask, completeTask, listTasks, formatTask, load } from "../src/tasks.js";
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
