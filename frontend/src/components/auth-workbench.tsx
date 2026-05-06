"use client";

import { FormEvent, useState } from "react";

const TOKEN_KEY = "stratos.jwtToken";
const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

type LoginApiResponse = {
  success?: boolean;
  message?: string;
  data?: {
    token?: string;
  };
};

type ProxyResponse = {
  ok?: boolean;
  status?: number;
  data?: LoginApiResponse;
  error?: string;
};

export default function AuthWorkbench() {
  const [email, setEmail] = useState("admin@stratos.edu");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setFeedback("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const loginPaths = ["/api/auth/login/faculty", "/api/auth/login/student"];
      let lastErrorMessage = "Invalid credentials. Please check your email and password.";

      for (const path of loginPaths) {
        const response = await fetch("/api/proxy", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            baseUrl: DEFAULT_BASE_URL,
            path,
            method: "POST",
            bodyText: JSON.stringify({ email: trimmedEmail, password }),
          }),
        });

        const payload = (await response.json()) as ProxyResponse;

        if (!response.ok) {
          setFeedback(payload.error || "Unable to complete login request.");
          return;
        }

        const token = payload.data?.data?.token;
        if (payload.ok && token) {
          window.localStorage.setItem(TOKEN_KEY, token);
          setFeedback("Login successful.");
          return;
        }

        if (payload.data?.message) {
          lastErrorMessage = payload.data.message;
        }
      }

      setFeedback(lastErrorMessage);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unexpected login error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-8">
      <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">StratosERP</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">Login</h1>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:bg-white"
            placeholder="admin@stratos.edu"
            autoComplete="email"
            required
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:bg-white"
            placeholder="password123"
            autoComplete="current-password"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-1 w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-500"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>

      {feedback ? <p className="mt-4 rounded-xl bg-zinc-100 px-3 py-2 text-sm text-zinc-700">{feedback}</p> : null}
    </section>
  );
}
