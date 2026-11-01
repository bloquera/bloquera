function getContentSecurityPolicy() {
  const isVercelPreview = process.env.VERCEL_ENV === "preview";
  const previewConnectSources = isVercelPreview
    ? " https://vercel.com https://vercel.live"
    : "";
  const previewFrameSources = isVercelPreview ? " https://vercel.live" : "";
  const previewScriptSources = isVercelPreview ? " https://vercel.live" : "";

  return [
    "default-src 'self'",
    "base-uri 'self'",
    `connect-src 'self' https://*.supabase.co https://*.vercel-insights.com${previewConnectSources}`,
    "font-src 'self' data:",
    "form-action 'self' https://checkout.stripe.com",
    "frame-ancestors 'none'",
    `frame-src https://js.stripe.com https://hooks.stripe.com${previewFrameSources}`,
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "object-src 'none'",
    `script-src 'self' 'unsafe-inline'${previewScriptSources}`,
    "style-src 'self' 'unsafe-inline'",
    "upgrade-insecure-requests",
  ].join("; ");
}

function getSecurityHeaders() {
  return [
    {
      key: "Content-Security-Policy",
      value: getContentSecurityPolicy(),
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
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        headers: getSecurityHeaders(),
        source: "/:path*",
      },
    ];
  },
  typedRoutes: true,
};

module.exports = nextConfig;
