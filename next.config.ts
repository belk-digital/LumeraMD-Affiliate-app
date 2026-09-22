import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Lets a second `next dev` instance (e.g. one pointed at a test DB via .env.local) run
  // alongside the main one without fighting over the same build cache/dev-server lock.
  // Unset by default, so normal dev/build behavior is unchanged.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

export default nextConfig;
