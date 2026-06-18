"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Digest" },
];

export default function NavTabs() {
  const pathname = usePathname();

  return (
    <nav className="nav-tabs" aria-label="Primary">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={pathname === tab.href ? "page" : undefined}
          className="no-underline"
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
