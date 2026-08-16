import Link from "next/link";

import { publicGuides } from "@/lib/public-guides";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-zinc-500 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p>© 2026 Bloquera</p>
          <p className="text-zinc-400">Bloquera — Learn crypto with clarity</p>
        </div>
        <nav className="flex flex-wrap gap-5">
          <Link href="/">Home</Link>
          <Link href="/pricing">Pricing</Link>
          {publicGuides.map((guide) => (
            <Link key={guide.id} href={guide.href}>
              {guide.eyebrow}
            </Link>
          ))}
          <Link href="/learn">Curriculum</Link>
          <Link href="/auth/login">Log in</Link>
        </nav>
      </div>
    </footer>
  );
}
