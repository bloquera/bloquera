import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { Footer } from "@/components/layout/Footer";
import { GuideLandingPage } from "@/components/marketing/GuideLandingPage";
import { getPublicGuide, publicGuides } from "@/lib/public-guides";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("GuideLandingPage internal links", () => {
  it("connects a guide to related guides and its relevant curriculum module", () => {
    const guide = getPublicGuide("crypto-wallet-basics");

    expect(guide).toBeDefined();
    render(<GuideLandingPage guide={guide!} />);

    expect(
      screen.getByRole("link", { name: /Explore wallets and ownership lessons/i }),
    ).toHaveAttribute("href", "/learn/module/wallets-and-ownership");
    expect(
      screen.getByRole("link", { name: /Crypto security basics for beginners/i }),
    ).toHaveAttribute("href", "/crypto-security-basics");
    expect(
      screen.getByRole("link", { name: /How crypto transactions work for beginners/i }),
    ).toHaveAttribute("href", "/how-crypto-transactions-work");
    expect(
      screen.queryByRole("link", { name: /Crypto wallet basics for real beginners/i }),
    ).not.toBeInTheDocument();
  });

  it("lists every public guide in the global footer", () => {
    render(<Footer />);

    for (const guide of publicGuides) {
      expect(screen.getByRole("link", { name: guide.eyebrow })).toHaveAttribute(
        "href",
        guide.href,
      );
    }
  });
});
