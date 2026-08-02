import type { NextConfig } from "next";

const isPages = process.env.GITHUB_PAGES === "true";
const basePath = isPages ? "/mz-audio-tools" : "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
  // The Pages export contains only the client-side instrument routes.
  // Cloudflare worker/database files remain in the repository for the
  // original hosting workflow, but are not part of this static site.
  typescript: { ignoreBuildErrors: isPages },
};

export default nextConfig;
