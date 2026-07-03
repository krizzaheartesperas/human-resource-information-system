import os from "node:os";
import type { NextConfig } from "next";

/**
 * When you open the dev server via a LAN URL (e.g. http://192.168.x.x:3000), Next.js
 * treats RSC prefetches to /_next/* as cross-origin unless the host is allowlisted.
 * Without this, the console shows "Failed to fetch" during navigation / prefetch.
 *
 * Set HRIS_ALLOWED_DEV_ORIGINS in .env.local (comma-separated hostnames) if your IP
 * is not detected (VPN, unusual NIC layout).
 */
function developmentAllowedDevOrigins(): string[] | undefined {
  if (process.env.NODE_ENV !== "development") return undefined;
  const envExtras =
    process.env.HRIS_ALLOWED_DEV_ORIGINS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  const fromOs = new Set<string>();
  for (const list of Object.values(os.networkInterfaces())) {
    for (const addr of list ?? []) {
      if (addr && addr.family === "IPv4" && !addr.internal) {
        fromOs.add(addr.address);
      }
    }
  }
  const needsExplicitAllowlist = fromOs.size > 0 || envExtras.length > 0;
  if (!needsExplicitAllowlist) return undefined;
  return [...new Set(["127.0.0.1", "::1", ...envExtras, ...fromOs])];
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  turbopack: {
    root: process.cwd(),
  },
  compress: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@radix-ui/react-dialog",
      "@radix-ui/react-tabs",
      "@radix-ui/react-switch",
      "@radix-ui/react-slot",
    ],
  },
  modularizeImports: {
    "lucide-react": {
      transform: "lucide-react/dist/esm/icons/{{kebabCase member}}",
      skipDefaultConversion: true,
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 7,
    remotePatterns: [
      { protocol: "https", hostname: "ui-avatars.com", pathname: "/api/**" },
    ],
  },
  assetPrefix: process.env.NEXT_PUBLIC_CDN_URL || undefined,

  async redirects() {
    return [
      {
        source: "/payslips",
        destination: "/payroll?tab=overview&mode=my-payslips",
        permanent: true,
      },
      {
        source: "/complaints/manager",
        destination: "/complaints?panel=overview",
        permanent: false,
      },
      {
        source: "/complaints/manager/approval/:id",
        destination: "/complaints/:id?context=manager-approval",
        permanent: false,
      },
      {
        source: "/complaints/manager/escalated/:id",
        destination: "/complaints/:id?context=manager-escalated",
        permanent: false,
      },
      {
        source: "/complaints/admin",
        destination: "/complaints?tab=all",
        permanent: false,
      },
      {
        source: "/complaints/staff",
        destination: "/complaints?panel=dashboard",
        permanent: false,
      },
      {
        source: "/complaints/audit",
        destination: "/complaints?tab=records",
        permanent: false,
      },
      {
        source: "/complaints/executive",
        destination: "/complaints?scope=executive",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:path*\\.(ico|jpg|jpeg|png|gif|webp|avif|svg|js|css|woff|woff2|ttf|otf)$",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

const devOrigins = developmentAllowedDevOrigins();
if (devOrigins?.length) {
  nextConfig.allowedDevOrigins = devOrigins;
}

export default nextConfig;
