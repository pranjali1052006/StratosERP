"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import type { RoleSlug } from "@/lib/role-blueprints";

const TOKEN_KEY = "stratos.jwtToken";
const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";
const ALLOWED_EMAIL_DOMAIN = "@tcetmumbai.in";

const ROLE_TO_SLUG: Record<string, RoleSlug> = {
  Admin: "admin",
  HOD: "hod",
  ClassIncharge: "class-incharge",
  SubjectIncharge: "subject-incharge",
  PracticalTeacher: "practical-teacher",
  TG: "teacher-guardian",
  Student: "student",
};

type LoginApiResponse = {
  success?: boolean;
  message?: string;
  data?: {
    token?: string;
    faculty?: {
      role?: string;
    };
    student?: {
      role?: string;
    };
  };
};

type ProxyResponse = {
  ok?: boolean;
  status?: number;
  data?: LoginApiResponse;
  error?: string;
};

function decodeJwtRole(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, "=");
    const parsed = JSON.parse(atob(padded)) as { role?: unknown };

    return typeof parsed.role === "string" ? parsed.role : null;
  } catch {
    return null;
  }
}

function extractRole(loginData?: LoginApiResponse["data"]): string | null {
  const facultyRole = loginData?.faculty?.role;
  if (typeof facultyRole === "string") return facultyRole;

  const studentRole = loginData?.student?.role;
  if (typeof studentRole === "string") return studentRole;

  if (typeof loginData?.token === "string") {
    return decodeJwtRole(loginData.token);
  }

  return null;
}

export default function AuthWorkbench() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@tcetmumbai.in");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setFeedback("Please enter both email and password.");
      return;
    }

    if (!trimmedEmail.toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN)) {
      setFeedback(`Only ${ALLOWED_EMAIL_DOMAIN} email addresses are allowed.`);
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

        const loginData = payload.data?.data;
        const token = loginData?.token;
        if (payload.ok && token) {
          window.localStorage.setItem(TOKEN_KEY, token);
          const role = extractRole(loginData);
          const roleSlug = role ? ROLE_TO_SLUG[role] : undefined;

          if (!roleSlug) {
            setFeedback("Login successful, but your role is not mapped to a portal yet.");
            return;
          }

          setFeedback(`Login successful. Redirecting to ${role} portal...`);
          router.push(`/portal/${roleSlug}`);
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
            placeholder="admin@tcetmumbai.in"
            autoComplete="email"
            pattern={"^[^\\s@]+@tcetmumbai\\.in$"}
            title="Use your @tcetmumbai.in email"
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
            placeholder="Enter your password"
            autoComplete="off"
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
