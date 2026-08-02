import type { NextConfig } from "next";

const isPages = process.env.GITHUB_PAGES === "true";
const basePath = isPages ? "/mz-audio-tools" : "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
};

export default nextConfig;
