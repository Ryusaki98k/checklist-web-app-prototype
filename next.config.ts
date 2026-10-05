import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  // Next 16 blocks cross-origin requests to dev-only endpoints, including the
  // HMR websocket at /_next/hmr, unless the request's hostname is allowlisted.
  // Matching is on hostname only - no protocol, no port (see
  // node_modules/next/dist/server/lib/router-utils/block-cross-site-dev.js).
  //   26.4.46.145    Radmin VPN adapter
  //   192.168.1.46   LAN, for testing on a phone
  // Requires a dev-server restart; this config is read only at boot.
  allowedDevOrigins: ["26.4.46.145", "192.168.1.46"],
};

export default nextConfig;
