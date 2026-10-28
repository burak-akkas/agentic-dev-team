import type { NextConfig } from "next";

// GitHub Pages serves the site from /<repo>; the deploy workflow sets NEXT_PUBLIC_BASE_PATH.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
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
