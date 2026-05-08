import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse v2 → pdfjs-dist needs to load a worker file at runtime.
  // Webpack mangles the worker import path; mark these external so Node
  // requires them straight from node_modules with their real paths intact.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
