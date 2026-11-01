import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

// GitHub Pages serves the site from /<repo>; the deploy workflow sets NEXT_PUBLIC_BASE_PATH.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version?: unknown };
    return typeof pkg.version === "string" ? pkg.version : "";
  } catch {
    return "";
  }
}

function readCommit(): string {
  const fromEnv = process.env.GITHUB_SHA?.trim();
  if (fromEnv) return fromEnv;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: readVersion(),
    NEXT_PUBLIC_COMMIT_SHA: readCommit(),
  },
  // Static export: `next build` writes plain HTML/CSS/JS to out/ (no server needed).
  output: "export",
  basePath,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
