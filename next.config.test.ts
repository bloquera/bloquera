import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextConfig = require("./next.config.js") as {
  headers: () => Promise<
    Array<{
      headers: Array<{ key: string; value: string }>;
      source: string;
    }>
  >;
};

describe("Next.js security headers", () => {
  it("applies baseline security headers to every route", async () => {
    const rules = await nextConfig.headers();
    const headers = Object.fromEntries(
      rules[0].headers.map(({ key, value }) => [key, value]),
    );

    expect(rules[0].source).toBe("/:path*");
    expect(headers["Content-Security-Policy-Report-Only"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers["Permissions-Policy"]).toBe(
      "camera=(), geolocation=(), microphone=()",
    );
    expect(headers["Referrer-Policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headers["Strict-Transport-Security"]).toContain("includeSubDomains");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
  });
});
