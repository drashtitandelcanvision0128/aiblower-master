"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Sign in failed");
        setLoading(false);
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold text-white">Admin sign in</h1>
      <p className="mt-2 text-sm text-emerald-100/70">Use your admin email and password (stored in Postgres).</p>
      <form onSubmit={(e) => void onSubmit(e)} className="mt-8 space-y-4 rounded-2xl border border-emerald-800/50 bg-[#042f1f]/60 p-6">
        {error ? (
          <p className="text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-emerald-200/80">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-emerald-800/60 bg-[#021910] px-3 py-2 text-sm text-white outline-none ring-emerald-500/40 focus:ring-2"
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-xs font-medium text-emerald-200/80">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-emerald-800/60 bg-[#021910] px-3 py-2 text-sm text-white outline-none ring-emerald-500/40 focus:ring-2"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-emerald-400 py-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-300 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
