import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "evhesap.vercel.app" }],
        // Supabase currently accepts OAuth callbacks on this origin. Redirect
        // before rendering or starting OAuth so PKCE and sessions stay together.
        destination: "https://ev-harcama-takip.vercel.app/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
