#!/usr/bin/env node
import { addTask, completeTask, removeTask, listTasks, formatTask, load, save } from "../src/tasks.js";

const USAGE = `Usage:
  tasks add <title>     Add a task
  tasks done <id>       Mark a task as done
  tasks remove <id>     Remove a task
  tasks list [--all]    List open tasks (or all tasks)

Tasks are stored in $TASKS_FILE (default: ./tasks.json).`;

export function run(argv, { file = process.env.TASKS_FILE || "tasks.json", out = console.log } = {}) {
  const [command, ...args] = argv;
  const tasks = load(file);

  switch (command) {
    case "add": {
      const updated = addTask(tasks, args.join(" "));
      save(file, updated);
      out(`Added: ${formatTask(updated.at(-1))}`);
      return 0;
    }
    case "done": {
      const id = Number(args[0]);
      if (!Number.isInteger(id)) {
        throw new Error("Usage: tasks done <id>");
      }
      save(file, completeTask(tasks, id));
      out(`Completed task ${id}`);
      return 0;
    }
    case "remove": {
      const id = Number(args[0]);
      if (!Number.isInteger(id)) {
        throw new Error("Usage: tasks remove <id>");
      }
      save(file, removeTask(tasks, id));
      out(`Removed task ${id}`);
      return 0;
    }
    case "list": {
      const shown = listTasks(tasks, { all: args.includes("--all") });
      out(shown.length ? shown.map(formatTask).join("\n") : "No tasks.");
      return 0;
    }
    default:
      out(USAGE);
      return command ? 1 : 0;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exitCode = run(process.argv.slice(2));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
  }
}
