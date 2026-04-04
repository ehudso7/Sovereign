import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  eslint: {
    // Linting is enforced by the dedicated workspace gate; skip Next's duplicate pass.
    ignoreDuringBuilds: true,
  },
  outputFileTracingRoot: workspaceRoot,
};

export default nextConfig;
