import { readFileSync, writeFileSync, existsSync } from "node:fs";

// Pure functions operate on a list of tasks: { id, title, done, createdAt }.

export function addTask(tasks, title, now = new Date()) {
  const trimmed = String(title ?? "").trim();
  if (!trimmed) {
    throw new Error("Task title must not be empty");
  }
  const id = tasks.reduce((max, t) => Math.max(max, t.id), 0) + 1;
  const task = { id, title: trimmed, done: false, createdAt: now.toISOString() };
  return [...tasks, task];
}

export function completeTask(tasks, id) {
  if (!tasks.some((t) => t.id === id)) {
    throw new Error(`Task ${id} not found`);
  }
  return tasks.map((t) => (t.id === id ? { ...t, done: true } : t));
}

export function removeTask(tasks, id) {
  if (!tasks.some((t) => t.id === id)) {
    throw new Error(`Task ${id} not found`);
  }
  return tasks.filter((t) => t.id !== id);
}

export function listTasks(tasks, { all = false } = {}) {
  return all ? tasks : tasks.filter((t) => !t.done);
}

export function formatTask(task) {
  return `${task.done ? "[x]" : "[ ]"} ${task.id}. ${task.title}`;
}

// Storage: a JSON file holding the task array.

export function load(file) {
  if (!existsSync(file)) {
    return [];
  }
  return JSON.parse(readFileSync(file, "utf8"));
}

export function save(file, tasks) {
  writeFileSync(file, JSON.stringify(tasks, null, 2) + "\n");
}
