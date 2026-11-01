const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self' https://*.supabase.co https://*.vercel-insights.com",
  "font-src 'self' data:",
  "form-action 'self' https://checkout.stripe.com",
  "frame-ancestors 'none'",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy-Report-Only",
    value: contentSecurityPolicy,
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=()",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        headers: securityHeaders,
        source: "/:path*",
      },
    ];
  },
  typedRoutes: true,
};

module.exports = nextConfig;
