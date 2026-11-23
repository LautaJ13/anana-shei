"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PanelNav({ items }: { items: { href: string; label: string }[] }) {
  const current = usePathname();
  const base = items[0]?.href ?? "";
  return (
    <nav className="flex gap-2 overflow-x-auto lg:flex-col" aria-label="Panel del consultorio">
      {items.map((item) => {
        const active = item.href === base ? current === base : current === item.href || current.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold ${active ? "bg-navy text-white" : "bg-white text-navy"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
