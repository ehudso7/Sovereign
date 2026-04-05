"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import {
  IconDashboard,
  IconAgents,
  IconRuns,
  IconConnectors,
  IconSkills,
  IconBrowser,
  IconMemory,
  IconMissionControl,
  IconRevenue,
  IconBilling,
  IconPolicies,
  IconApprovals,
  IconQuarantine,
  IconAudit,
  IconSettings,
  IconMembers,
  IconDocs,
  IconSupport,
  IconAdmin,
  IconOnboarding,
  IconProjects,
  IconSearch,
  IconSun,
  IconMoon,
  IconBell,
  IconMenu,
  IconX,
  IconChevronDown,
} from "./icons";

// ---------------------------------------------------------------------------
// Navigation configuration
// ---------------------------------------------------------------------------

interface NavItem {
  label: string;
  href: string;
  icon: React.FC<{ size?: number }>;
  badge?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: IconDashboard },
      { label: "Mission Control", href: "/mission-control", icon: IconMissionControl },
    ],
  },
  {
    title: "Build",
    items: [
      { label: "Projects", href: "/projects", icon: IconProjects },
      { label: "Agents", href: "/agents", icon: IconAgents },
      { label: "Runs", href: "/runs", icon: IconRuns },
      { label: "Connectors", href: "/connectors", icon: IconConnectors },
      { label: "Skills", href: "/skills", icon: IconSkills },
      { label: "Browser", href: "/browser-sessions", icon: IconBrowser },
      { label: "Memory", href: "/memories", icon: IconMemory },
    ],
  },
  {
    title: "Business",
    items: [
      { label: "Revenue", href: "/revenue", icon: IconRevenue },
      { label: "Billing", href: "/billing", icon: IconBilling },
    ],
  },
  {
    title: "Governance",
    items: [
      { label: "Policies", href: "/policies", icon: IconPolicies },
      { label: "Approvals", href: "/approvals", icon: IconApprovals },
      { label: "Quarantine", href: "/quarantine", icon: IconQuarantine },
      { label: "Audit Log", href: "/audit", icon: IconAudit },
    ],
  },
];

const BOTTOM_NAV: NavItem[] = [
  { label: "Setup", href: "/onboarding", icon: IconOnboarding },
  { label: "Docs", href: "/docs", icon: IconDocs },
  { label: "Support", href: "/support", icon: IconSupport },
  { label: "Admin", href: "/admin", icon: IconAdmin },
  { label: "Members", href: "/settings/members", icon: IconMembers },
  { label: "Settings", href: "/settings/org", icon: IconSettings },
];

// ---------------------------------------------------------------------------
// Theme hook
// ---------------------------------------------------------------------------

function useTheme() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sovereign_theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = stored === "dark" || (!stored && prefersDark);
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("sovereign_theme", next ? "dark" : "light");
      return next;
    });
  }, []);

  return { isDark, toggle };
}

// ---------------------------------------------------------------------------
// Sidebar Nav Item
// ---------------------------------------------------------------------------

function SidebarItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const isActive =
    pathname === item.href || pathname.startsWith(item.href + "/");

  return (
    <Link
      href={item.href}
      className={`
        group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150
        ${collapsed ? "justify-center px-2" : ""}
        ${
          isActive
            ? "bg-[rgb(var(--color-sidebar-active))] text-[rgb(var(--color-sidebar-text-active))]"
            : "text-[rgb(var(--color-sidebar-text))] hover:bg-[rgb(var(--color-sidebar-hover))] hover:text-[rgb(var(--color-sidebar-text-active))]"
        }
      `}
      title={collapsed ? item.label : undefined}
    >
      <item.icon size={18} />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge && (
            <span className="rounded-full bg-[rgb(var(--color-brand))] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
              {item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Sidebar Group
// ---------------------------------------------------------------------------

function SidebarGroup({
  group,
  collapsed,
}: {
  group: NavGroup;
  collapsed: boolean;
}) {
  return (
    <div className="space-y-0.5">
      {!collapsed && (
        <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-[rgb(var(--color-sidebar-text))] opacity-60">
          {group.title}
        </div>
      )}
      {collapsed && <div className="my-2 border-t border-white/10" />}
      {group.items.map((item) => (
        <SidebarItem key={item.href} item={item} collapsed={collapsed} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Command palette trigger (visual only — future feature)
// ---------------------------------------------------------------------------

function SearchBar({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <button
        className="flex w-full items-center justify-center rounded-md p-2 text-[rgb(var(--color-sidebar-text))] transition-colors hover:bg-[rgb(var(--color-sidebar-hover))] hover:text-[rgb(var(--color-sidebar-text-active))]"
        title="Search"
      >
        <IconSearch size={18} />
      </button>
    );
  }
  return (
    <button className="flex w-full items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-[rgb(var(--color-sidebar-text))] transition-colors hover:bg-white/10 hover:text-[rgb(var(--color-sidebar-text-active))]">
      <IconSearch size={16} />
      <span className="flex-1 text-left opacity-60">Search...</span>
      <span className="kbd border-white/20 bg-white/10 text-white/40">/</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main AppShell
// ---------------------------------------------------------------------------

export function AppShell({ children }: { children: ReactNode }) {
  const { user, org, signOut } = useAuth();
  const { isDark, toggle } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Close mobile nav on route change
  const pathname = usePathname();
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-[rgb(var(--color-bg-primary))]">
      {/* ── Mobile Overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col
          bg-[rgb(var(--color-sidebar-bg))] transition-all duration-200
          lg:relative lg:z-auto
          ${collapsed ? "w-16" : "w-60"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* ── Logo area ── */}
        <div
          className={`flex h-14 shrink-0 items-center border-b border-white/10 px-4 ${
            collapsed ? "justify-center" : "justify-between"
          }`}
        >
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgb(var(--color-brand))] font-bold text-white text-sm">
              S
            </div>
            {!collapsed && (
              <span className="text-sm font-bold tracking-widest text-white">
                SOVEREIGN
              </span>
            )}
          </Link>
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="rounded p-1 text-[rgb(var(--color-sidebar-text))] transition-colors hover:bg-[rgb(var(--color-sidebar-hover))] hover:text-white lg:block hidden"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="11 17 6 12 11 7" />
                <polyline points="18 17 13 12 18 7" />
              </svg>
            </button>
          )}
          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              className="absolute -right-3 top-4 hidden rounded-full border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] p-0.5 shadow-sm transition-colors hover:bg-[rgb(var(--color-bg-secondary))] lg:block"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[rgb(var(--color-text-secondary))]">
                <polyline points="13 17 18 12 13 7" />
              </svg>
            </button>
          )}
        </div>

        {/* ── Search ── */}
        <div className="px-3 pt-3">
          <SearchBar collapsed={collapsed} />
        </div>

        {/* ── Main Nav ── */}
        <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-hide px-2 pt-2">
          {NAV_GROUPS.map((group) => (
            <SidebarGroup key={group.title} group={group} collapsed={collapsed} />
          ))}
        </nav>

        {/* ── Bottom Nav ── */}
        <div className="border-t border-white/10 px-2 py-2 space-y-0.5">
          {BOTTOM_NAV.map((item) => (
            <SidebarItem key={item.href} item={item} collapsed={collapsed} />
          ))}
        </div>

        {/* ── User area ── */}
        <div className="border-t border-white/10 p-3">
          {collapsed ? (
            <button
              onClick={() => setCollapsed(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(var(--color-brand))] text-xs font-bold text-white"
              title={user?.email}
            >
              {user?.name?.[0]?.toUpperCase() ?? "?"}
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-[rgb(var(--color-sidebar-hover))]"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--color-brand))] text-xs font-bold text-white">
                  {user?.name?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="truncate text-xs font-medium text-white">
                    {user?.name ?? "User"}
                  </div>
                  <div className="truncate text-[10px] text-[rgb(var(--color-sidebar-text))]">
                    {org?.name ?? ""}
                  </div>
                </div>
                <IconChevronDown size={14} className="text-[rgb(var(--color-sidebar-text))]" />
              </button>

              {userMenuOpen && (
                <div className="absolute bottom-full left-0 mb-1 w-full rounded-md border border-white/10 bg-[rgb(var(--color-sidebar-bg))] py-1 shadow-lg">
                  <div className="border-b border-white/10 px-3 py-2">
                    <div className="text-xs text-white">{user?.email}</div>
                    <div className="text-[10px] text-[rgb(var(--color-sidebar-text))]">
                      {org?.plan ?? "Free"} plan
                    </div>
                  </div>
                  <button
                    onClick={() => toggle()}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[rgb(var(--color-sidebar-text))] transition-colors hover:bg-[rgb(var(--color-sidebar-hover))] hover:text-white"
                  >
                    {isDark ? <IconSun size={14} /> : <IconMoon size={14} />}
                    {isDark ? "Light Mode" : "Dark Mode"}
                  </button>
                  <button
                    onClick={signOut}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-400 transition-colors hover:bg-[rgb(var(--color-sidebar-hover))] hover:text-red-300"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* ── Top Bar ── */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-1.5 text-[rgb(var(--color-text-secondary))] transition-colors hover:bg-[rgb(var(--color-bg-tertiary))] lg:hidden"
            >
              <IconMenu size={20} />
            </button>
            {/* Mobile close when open */}
            {mobileOpen && (
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1.5 text-[rgb(var(--color-text-secondary))] lg:hidden"
              >
                <IconX size={20} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              className="hidden rounded-md p-2 text-[rgb(var(--color-text-tertiary))] transition-colors hover:bg-[rgb(var(--color-bg-tertiary))] hover:text-[rgb(var(--color-text-primary))] lg:block"
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
            </button>
            <button className="relative rounded-md p-2 text-[rgb(var(--color-text-tertiary))] transition-colors hover:bg-[rgb(var(--color-bg-tertiary))] hover:text-[rgb(var(--color-text-primary))]">
              <IconBell size={18} />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[rgb(var(--color-error))]" />
            </button>
          </div>
        </header>

        {/* ── Page Content ── */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
