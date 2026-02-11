import type { NextConfig } from "next";

const distDir = process.env.NEXT_DIST_DIR || ".next-build";

const nextConfig: NextConfig = {
  distDir,
};

export default nextConfig;
