"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

interface NavItem {
  href: string;
  label: string;
  match?: (path: string) => boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/", label: "Dashboard", match: (p) => p === "/" },
      {
        href: "/projects",
        label: "Assets in Process",
        match: (p) => p === "/projects" || p.startsWith("/projects/"),
      },
    ],
  },
  {
    label: "Authoring Admin",
    items: [
      { href: "/authoring/policies", label: "Policies" },
      { href: "/authoring/questions", label: "Questions" },
      { href: "/authoring/scans", label: "Guidance editor" },
      { href: "/authoring/library", label: "Guidance library" },
      { href: "/corpus", label: "Corpus" },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/admin", label: "Activity Binds", match: (p) => p === "/admin" },
      { href: "/admin/models", label: "Models" },
      { href: "/admin/prompts", label: "Prompts" },
      { href: "/admin/settings", label: "Settings" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 flex-shrink-0 border-r border-ey-dark-gray bg-ey-black flex flex-col">
      <div className="px-4 py-5 border-b border-ey-dark-gray">
        <Link href="/" className="flex items-end gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/Brand/EY_Logo_Beam_C_CMYK_Dark.svg"
            alt="EY"
            width={32}
            height={32}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/Brand/arc.svg"
            alt="ARC"
            className="h-12 w-auto"
          />
        </Link>
      </div>
      <nav className="flex-1 py-3 text-sm overflow-y-auto">
        {GROUPS.map((group) => (
          <NavGroupSection key={group.label} group={group} pathname={pathname} />
        ))}
      </nav>
    </aside>
  );
}

function NavGroupSection({ group, pathname }: { group: NavGroup; pathname: string }) {
  return (
    <div className="pb-2">
      <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ey-sonic-silver">
        {group.label}
      </p>
      {group.items.map((item) => {
        const active = item.match
          ? item.match(pathname)
          : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <NavLink key={item.href} href={item.href} active={active}>
            {item.label}
          </NavLink>
        );
      })}
    </div>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`block px-4 py-2 transition-colors ${
        active
          ? "bg-ey-dark-gray text-ey-yellow border-l-2 border-ey-yellow"
          : "text-ey-light-gray hover:bg-ey-dark-gray hover:text-ey-yellow border-l-2 border-transparent"
      }`}
    >
      {children}
    </Link>
  );
}
