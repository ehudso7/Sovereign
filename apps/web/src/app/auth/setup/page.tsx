"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toTitleCase(value: string): string {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function suggestedOrgName(email: string, name: string): string {
  const [, domain = ""] = email.split("@");
  const company = domain.split(".")[0]?.replace(/[^a-zA-Z0-9]+/g, " ").trim();
  if (company) {
    return toTitleCase(company);
  }

  if (name.trim().length > 0) {
    return `${name.trim()}'s Workspace`;
  }

  return "My Organization";
}

export default function WorkosSetupPage() {
  const router = useRouter();
  const { bootstrapWithWorkos } = useAuth();
  const [bootstrapToken, setBootstrapToken] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = fragment.get("bootstrap_token");

    if (!token) {
      router.replace("/auth/sign-in?error=Missing%20bootstrap%20token");
      return;
    }

    const fragmentEmail = fragment.get("email") ?? "";
    const fragmentName = fragment.get("name") ?? "";
    const initialOrgName = suggestedOrgName(fragmentEmail, fragmentName);

    setBootstrapToken(token);
    setEmail(fragmentEmail);
    setName(fragmentName);
    setOrgName(initialOrgName);
    setOrgSlug(slugify(initialOrgName));
  }, [router]);

  useEffect(() => {
    if (slugManuallyEdited) {
      return;
    }

    setOrgSlug(slugify(orgName));
  }, [orgName, slugManuallyEdited]);

  const subtitle = useMemo(() => {
    if (email && name) {
      return `${name} (${email})`;
    }

    return email || "Authenticated WorkOS user";
  }, [email, name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const success = await bootstrapWithWorkos({
      token: bootstrapToken,
      orgName,
      orgSlug,
    });

    if (success) {
      router.push("/dashboard");
    } else {
      setError("Workspace setup failed. Check the API logs and bootstrap token state.");
    }

    setIsLoading(false);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[rgb(var(--color-bg-primary))] px-4">
      <div className="w-full max-w-md rounded-xl border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-secondary))] p-8 shadow-lg shadow-black/5">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-[rgb(var(--color-text-primary))]">
            Create Your First Workspace
          </h1>
          <p className="mt-2 text-sm text-[rgb(var(--color-text-secondary))]">
            {subtitle}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-[rgb(var(--color-error)/0.3)] bg-[rgb(var(--color-error)/0.08)] px-4 py-3 text-sm text-[rgb(var(--color-error))]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="orgName"
              className="mb-1.5 block text-sm font-medium text-[rgb(var(--color-text-primary))]"
            >
              Organization Name
            </label>
            <input
              id="orgName"
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
              className="input w-full"
              placeholder="Acme"
            />
          </div>

          <div>
            <label
              htmlFor="orgSlug"
              className="mb-1.5 block text-sm font-medium text-[rgb(var(--color-text-primary))]"
            >
              Organization Slug
            </label>
            <input
              id="orgSlug"
              type="text"
              value={orgSlug}
              onChange={(e) => {
                setSlugManuallyEdited(true);
                setOrgSlug(slugify(e.target.value));
              }}
              required
              pattern="[a-z0-9-]+"
              className="input w-full"
              placeholder="acme"
            />
            <p className="mt-1 text-xs text-[rgb(var(--color-text-tertiary))]">
              Lowercase letters, numbers, and hyphens only.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading || !bootstrapToken}
            className="w-full rounded-lg bg-[rgb(var(--color-brand))] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[rgb(var(--color-brand-dark))] disabled:opacity-50"
          >
            {isLoading ? "Creating workspace..." : "Create Workspace"}
          </button>
        </form>
      </div>
    </main>
  );
}
