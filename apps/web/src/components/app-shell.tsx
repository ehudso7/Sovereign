"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, org, signOut } = useAuth();

  return (
    <div className="min-h-screen">
      <nav className="border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-lg font-bold tracking-widest">
              SOVEREIGN
            </Link>
            <div className="flex gap-4 text-sm">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                Dashboard
              </Link>
              <Link href="/settings/org" className="text-gray-600 hover:text-gray-900">
                Settings
              </Link>
              <Link href="/agents" className="text-gray-600 hover:text-gray-900">
                Agents
              </Link>
              <Link href="/runs" className="text-gray-600 hover:text-gray-900">
                Runs
              </Link>
              <Link href="/connectors" className="text-gray-600 hover:text-gray-900">
                Connectors
              </Link>
              <Link href="/skills" className="text-gray-600 hover:text-gray-900">
                Skills
              </Link>
              <Link href="/browser-sessions" className="text-gray-600 hover:text-gray-900">
                Browser
              </Link>
              <Link href="/memories" className="text-gray-600 hover:text-gray-900">
                Memory
              </Link>
              <Link href="/settings/members" className="text-gray-600 hover:text-gray-900">
                Members
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {org && <span className="text-gray-500">{org.name}</span>}
            {user && <span className="text-gray-500">{user.email}</span>}
            <button
              onClick={signOut}
              className="text-gray-500 hover:text-gray-700"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
