"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  roleBlueprints,
  type ActionBlueprint,
  type RoleBlueprint,
} from "@/lib/role-blueprints";
import { phase1Dashboards } from "@/lib/phase1-dashboards";

type ActionState = {
  loading: boolean;
  status?: number;
  ok?: boolean;
  durationMs?: number;
  target?: string;
  payload?: unknown;
  error?: string;
};

type Panel = "overview" | "operations" | "analytics" | "activity";

type ActivityStatus = "info" | "success" | "error";

type ActivityEntry = {
  id: string;
  title: string;
  detail: string;
  status: ActivityStatus;
  timestamp: string;
};

const API_URL_KEY = "stratos.apiBaseUrl";
const TOKEN_KEY = "stratos.jwtToken";
const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

function prettyPrint(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Unable to display response payload.";
  }
}

function methodTone(method: ActionBlueprint["method"]): string {
  if (method === "GET") return "bg-sky-100 text-sky-800";
  if (method === "POST") return "bg-emerald-100 text-emerald-800";
  if (method === "PUT") return "bg-amber-100 text-amber-800";
  return "bg-zinc-200 text-zinc-700";
}

function activityTone(status: ActivityStatus): string {
  if (status === "success") return "bg-emerald-100 text-emerald-800";
  if (status === "error") return "bg-rose-100 text-rose-800";
  return "bg-sky-100 text-sky-800";
}

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function extractModuleKey(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts.length >= 3) return parts[2];
  return "core";
}

function clockStamp(): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RoleWorkspace({ role }: { role: RoleBlueprint }) {
  const initialBodyMap = useMemo(() => {
    return role.actions.reduce<Record<string, string>>((acc, action) => {
      acc[action.id] = action.body ? JSON.stringify(action.body, null, 2) : "";
      return acc;
    }, {});
  }, [role.actions]);

  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_BASE_URL);
  const [token, setToken] = useState("");
  const [bodyMap, setBodyMap] = useState<Record<string, string>>(initialBodyMap);
  const [fileMap, setFileMap] = useState<Record<string, File | null>>({});
  const [actionState, setActionState] = useState<Record<string, ActionState>>({});
  const [activePanel, setActivePanel] = useState<Panel>("overview");
  const [methodFilter, setMethodFilter] = useState<ActionBlueprint["method"] | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [lastActionId, setLastActionId] = useState<string | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const initialActivity = useMemo<ActivityEntry[]>(() => {
    return role.checkpoints.map((checkpoint, index) => ({
      id: `${role.slug}-seed-${index}`,
      title: "Operational Milestone",
      detail: checkpoint,
      status: "info",
      timestamp: `${index + 1}h ago`,
    }));
  }, [role.checkpoints, role.slug]);

  const moduleHealth = useMemo(() => {
    const grouped = new Map<string, ActionBlueprint[]>();
    role.actions.forEach((action) => {
      const key = extractModuleKey(action.path);
      const existing = grouped.get(key) || [];
      grouped.set(key, [...existing, action]);
    });

    return Array.from(grouped.entries()).map(([key, actions], index) => ({
      id: key,
      name: titleCase(key),
      actionCount: actions.length,
      completion: Math.max(68, 96 - index * 5),
      owner: `${role.roleName} Office`,
      sync: `${index + 1}h ago`,
    }));
  }, [role.actions, role.roleName]);

  const methodCounts = useMemo(() => {
    const counts: Record<ActionBlueprint["method"], number> = {
      GET: 0,
      POST: 0,
      PUT: 0,
      DELETE: 0,
    };
    role.actions.forEach((action) => {
      counts[action.method] += 1;
    });
    return counts;
  }, [role.actions]);

  const filteredActions = useMemo(() => {
    return role.actions.filter((action) => {
      const matchesMethod = methodFilter === "ALL" || action.method === methodFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        q.length === 0 ||
        action.label.toLowerCase().includes(q) ||
        action.path.toLowerCase().includes(q) ||
        action.description.toLowerCase().includes(q);
      return matchesMethod && matchesSearch;
    });
  }, [role.actions, methodFilter, searchQuery]);

  const peerRoles = useMemo(
    () => roleBlueprints.filter((item) => item.slug !== role.slug).slice(0, 4),
    [role.slug]
  );
  const phaseDashboard = phase1Dashboards[role.slug];

  const latestAction = useMemo(() => {
    if (!lastActionId) return null;
    return role.actions.find((action) => action.id === lastActionId) || null;
  }, [lastActionId, role.actions]);

  const latestState = lastActionId ? actionState[lastActionId] : undefined;

  const runCount = useMemo(
    () => Object.values(actionState).filter((state) => state.status !== undefined).length,
    [actionState]
  );

  const successCount = useMemo(
    () => Object.values(actionState).filter((state) => state.ok).length,
    [actionState]
  );

  useEffect(() => {
    const savedBaseUrl = window.localStorage.getItem(API_URL_KEY);
    const savedToken = window.localStorage.getItem(TOKEN_KEY);

    if (savedBaseUrl) {
      setApiBaseUrl(savedBaseUrl);
    }

    if (savedToken) {
      setToken(savedToken);
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    setBodyMap(initialBodyMap);
    setFileMap({});
    setActionState({});
    setActivePanel("overview");
    setMethodFilter("ALL");
    setSearchQuery("");
    setLastActionId(null);
    setActivityLog(initialActivity);
  }, [initialBodyMap, initialActivity]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(API_URL_KEY, apiBaseUrl.trim() || DEFAULT_BASE_URL);
  }, [apiBaseUrl, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(TOKEN_KEY, token.trim());
  }, [token, hydrated]);

  function pushActivity(entry: Omit<ActivityEntry, "id" | "timestamp">): void {
    setActivityLog((prev) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: clockStamp(),
        ...entry,
      },
      ...prev,
    ].slice(0, 18));
  }

  async function runAction(action: ActionBlueprint): Promise<void> {
    const bodyText = bodyMap[action.id] || "";
    const isMultipart = action.transport === "multipart";
    const selectedFile = fileMap[action.id] || null;
    let parsedBody: Record<string, unknown> | undefined;

    setLastActionId(action.id);

    if (action.method !== "GET" && action.method !== "DELETE" && bodyText.trim()) {
      try {
        const candidate = JSON.parse(bodyText);
        if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
          throw new Error("Payload must be a JSON object.");
        }
        parsedBody = candidate as Record<string, unknown>;
      } catch {
        setActionState((prev) => ({
          ...prev,
          [action.id]: {
            loading: false,
            error: "Body must be valid JSON before sending.",
          },
        }));
        pushActivity({
          title: action.label,
          detail: "Execution blocked due to invalid JSON payload.",
          status: "error",
        });
        return;
      }
    }

    if (isMultipart && !selectedFile) {
      setActionState((prev) => ({
        ...prev,
        [action.id]: {
          loading: false,
          error: "Please attach a file before executing this multipart endpoint.",
        },
      }));
      pushActivity({
        title: action.label,
        detail: "Execution blocked because no file was attached.",
        status: "error",
      });
      return;
    }

    setActionState((prev) => ({
      ...prev,
      [action.id]: { loading: true },
    }));

    try {
      const response = await (async () => {
        if (!isMultipart) {
          return fetch("/api/proxy", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              baseUrl: apiBaseUrl,
              path: action.path,
              method: action.method,
              token,
              bodyText,
            }),
          });
        }

        const formData = new FormData();
        formData.set("baseUrl", apiBaseUrl);
        formData.set("path", action.path);
        formData.set("method", action.method);
        formData.set("fieldsJson", JSON.stringify(parsedBody || {}));
        formData.set("fileFieldName", action.fileFieldName || "file");

        if (token.trim()) {
          formData.set("token", token.trim());
        }

        formData.set("file", selectedFile as File);

        return fetch("/api/proxy", {
          method: "POST",
          body: formData,
        });
      })();

      const proxyPayload = (await response.json()) as {
        ok: boolean;
        status: number;
        durationMs: number;
        target: string;
        data: unknown;
        error?: string;
      };

      if (!response.ok) {
        setActionState((prev) => ({
          ...prev,
          [action.id]: {
            loading: false,
            error: proxyPayload.error || "Proxy request failed.",
            status: proxyPayload.status,
            ok: false,
            durationMs: proxyPayload.durationMs,
            target: proxyPayload.target,
            payload: proxyPayload.data,
          },
        }));
        pushActivity({
          title: action.label,
          detail: `Request failed with HTTP ${proxyPayload.status}.`,
          status: "error",
        });
        return;
      }

      setActionState((prev) => ({
        ...prev,
        [action.id]: {
          loading: false,
          status: proxyPayload.status,
          ok: proxyPayload.ok,
          durationMs: proxyPayload.durationMs,
          target: proxyPayload.target,
          payload: proxyPayload.data,
        },
      }));

      pushActivity({
        title: action.label,
        detail: `Completed with HTTP ${proxyPayload.status} in ${proxyPayload.durationMs} ms.`,
        status: "success",
      });
    } catch (error) {
      setActionState((prev) => ({
        ...prev,
        [action.id]: {
          loading: false,
          error: error instanceof Error ? error.message : "Unknown network error.",
        },
      }));

      pushActivity({
        title: action.label,
        detail: error instanceof Error ? error.message : "Unknown network error.",
        status: "error",
      });
    }
  }

  return (
    <div className="space-y-6">
      <section
        className="rounded-3xl border border-white/30 p-6 text-white shadow-[0_24px_70px_rgba(15,23,42,0.35)]"
        style={{
          backgroundImage: `linear-gradient(135deg, ${role.accentFrom}, ${role.accentTo})`,
        }}
      >
        <p className="text-xs uppercase tracking-[0.22em] text-white/80">Production Control Center</p>
        <h1 className="mt-2 text-3xl font-semibold">{role.roleName} Operations Portal</h1>
        <p className="mt-3 max-w-3xl text-sm text-white/90">{role.strapline}</p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-black/25 px-3 py-1 font-medium">Live API orchestration</span>
          <span className="rounded-full bg-black/25 px-3 py-1 font-medium">Workflow-aware modules</span>
          <span className="rounded-full bg-black/25 px-3 py-1 font-medium">Role-scoped execution</span>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {role.kpis.map((item) => (
            <article key={item.label} className="rounded-2xl bg-black/20 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.14em] text-white/75">{item.label}</p>
              <p className="mt-1 text-2xl font-semibold">{item.value}</p>
              <p className="mt-1 text-xs text-white/80">{item.hint}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[220px_1fr_320px]">
        <aside className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] xl:sticky xl:top-5 xl:h-fit">
          <h2 className="px-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Workspace</h2>
          <div className="space-y-2">
            {[
              { id: "overview", label: "Dashboard" },
              { id: "operations", label: "Operations" },
              { id: "analytics", label: "Analytics" },
              { id: "activity", label: "Activity" },
            ].map((item) => {
              const selected = activePanel === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActivePanel(item.id as Panel)}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                    selected
                      ? "bg-zinc-900 text-white shadow-[0_8px_24px_rgba(15,23,42,0.28)]"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-2 rounded-2xl bg-zinc-100 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Switch Role</p>
            {peerRoles.map((peer) => (
              <Link
                key={peer.slug}
                href={`/portal/${peer.slug}`}
                className="block rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:border-zinc-400"
              >
                {peer.roleName}
              </Link>
            ))}
          </div>
        </aside>

        <div className="space-y-5">
          {activePanel === "overview" ? (
            <>
              <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.08)]">
                <h2 className="text-xl font-semibold text-zinc-900">Phase-I {role.roleName} Dashboard</h2>
                <p className="mt-1 text-sm text-zinc-600">{phaseDashboard.northStar}</p>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {phaseDashboard.sections.map((section) => (
                    <article key={section.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                      <h3 className="text-sm font-semibold text-zinc-900">{section.title}</h3>
                      <p className="mt-2 text-xs text-zinc-600">{section.summary}</p>
                      <ul className="mt-3 space-y-2">
                        {section.highlights.map((highlight) => (
                          <li key={highlight} className="rounded-lg bg-white px-3 py-2 text-xs text-zinc-700">
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <article className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <h3 className="text-sm font-semibold text-zinc-900">Workflow Priorities</h3>
                    <ul className="mt-3 space-y-2">
                      {role.checkpoints.map((point, idx) => (
                        <li key={point} className="rounded-lg bg-white px-3 py-2 text-xs text-zinc-700">
                          {`Step ${idx + 1}: ${point}`}
                        </li>
                      ))}
                    </ul>
                  </article>

                  <article className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <h3 className="text-sm font-semibold text-zinc-900">Governance Rails</h3>
                    <ul className="mt-3 space-y-2">
                      {phaseDashboard.governanceRail.map((rule) => (
                        <li key={rule} className="rounded-lg bg-white px-3 py-2 text-xs text-zinc-700">
                          {rule}
                        </li>
                      ))}
                    </ul>
                  </article>
                </div>
              </article>

              <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.08)]">
                <h2 className="text-xl font-semibold text-zinc-900">Module Health</h2>
                <p className="mt-1 text-sm text-zinc-600">Operational modules inferred from live endpoint surfaces.</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {moduleHealth.map((module) => (
                    <article key={module.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-zinc-900">{module.name}</p>
                        <span className="rounded-full bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-zinc-100">
                          {module.actionCount} endpoints
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-zinc-600">Owner: {module.owner}</p>
                      <div className="mt-3 h-2 rounded-full bg-zinc-200">
                        <div
                          className="h-2 rounded-full bg-zinc-900"
                          style={{ width: `${module.completion}%` }}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-zinc-600">
                        <span>Readiness {module.completion}%</span>
                        <span>Sync {module.sync}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </article>
            </>
          ) : null}

          {activePanel === "operations" ? (
            <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.08)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-zinc-900">Operations Queue</h2>
                  <p className="mt-1 text-sm text-zinc-600">Execute role APIs through structured production cards.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["ALL", "GET", "POST", "PUT", "DELETE"] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setMethodFilter(method)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        methodFilter === method
                          ? "bg-zinc-900 text-white"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <label className="mt-4 block">
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Search workflow</span>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search endpoint, label, or description"
                  className="mt-2 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:bg-white"
                />
              </label>

              <div className="mt-5 space-y-4">
                {filteredActions.map((action) => {
                  const state = actionState[action.id];
                  const bodyText = bodyMap[action.id] || "";
                  const selectedFile = fileMap[action.id];

                  return (
                    <article key={action.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${methodTone(action.method)}`}>
                          {action.method}
                        </span>
                        {action.transport === "multipart" ? (
                          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800">
                            MULTIPART
                          </span>
                        ) : null}
                        <code className="rounded-lg bg-zinc-900 px-2 py-1 text-xs text-zinc-100">{action.path}</code>
                      </div>
                      <h3 className="mt-3 text-lg font-semibold text-zinc-900">{action.label}</h3>
                      <p className="mt-1 text-sm text-zinc-600">{action.description}</p>

                      {action.method !== "GET" && action.method !== "DELETE" ? (
                        <label className="mt-4 block">
                          <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                            {action.transport === "multipart" ? "Form Fields JSON" : "Payload"}
                          </span>
                          <textarea
                            value={bodyText}
                            onChange={(event) =>
                              setBodyMap((prev) => ({
                                ...prev,
                                [action.id]: event.target.value,
                              }))
                            }
                            rows={8}
                            className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 outline-none transition focus:border-zinc-500"
                          />
                        </label>
                      ) : null}

                      {action.transport === "multipart" ? (
                        <label className="mt-4 block">
                          <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Attach File</span>
                          <input
                            type="file"
                            onChange={(event) =>
                              setFileMap((prev) => ({
                                ...prev,
                                [action.id]: event.target.files?.[0] || null,
                              }))
                            }
                            className="mt-2 block w-full cursor-pointer rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white hover:file:bg-zinc-700"
                          />
                          <p className="mt-2 text-xs text-zinc-600">
                            {selectedFile ? `Selected: ${selectedFile.name}` : "No file selected."}
                          </p>
                        </label>
                      ) : null}

                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => runAction(action)}
                          disabled={state?.loading}
                          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-500"
                        >
                          {state?.loading ? "Executing..." : "Execute"}
                        </button>

                        {state?.status ? (
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              state.ok ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            HTTP {state.status}
                          </span>
                        ) : null}

                        {state?.durationMs !== undefined ? (
                          <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700">
                            {state.durationMs} ms
                          </span>
                        ) : null}
                      </div>

                      {state?.error ? (
                        <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
                      ) : null}

                      {state?.payload !== undefined ? (
                        <pre className="mt-3 max-h-72 overflow-auto rounded-2xl bg-zinc-950 px-4 py-3 text-xs text-zinc-100">
                          {prettyPrint(state.payload)}
                        </pre>
                      ) : null}
                    </article>
                  );
                })}

                {filteredActions.length === 0 ? (
                  <p className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-600">
                    No actions match your current filter.
                  </p>
                ) : null}
              </div>
            </article>
          ) : null}

          {activePanel === "analytics" ? (
            <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.08)]">
              <h2 className="text-xl font-semibold text-zinc-900">Operational Analytics</h2>
              <p className="mt-1 text-sm text-zinc-600">Live execution and endpoint distribution for this role scope.</p>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Executed Calls</p>
                  <p className="mt-2 text-3xl font-semibold text-zinc-900">{runCount}</p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Successful Calls</p>
                  <p className="mt-2 text-3xl font-semibold text-zinc-900">{successCount}</p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Success Rate</p>
                  <p className="mt-2 text-3xl font-semibold text-zinc-900">
                    {runCount === 0 ? "0%" : `${Math.round((successCount / runCount) * 100)}%`}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <h3 className="text-sm font-semibold text-zinc-900">Method Distribution</h3>
                  <div className="mt-3 space-y-3">
                    {(Object.keys(methodCounts) as Array<ActionBlueprint["method"]>).map((method) => {
                      const value = methodCounts[method];
                      const width = role.actions.length
                        ? Math.max(8, Math.round((value / role.actions.length) * 100))
                        : 0;

                      return (
                        <div key={method}>
                          <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
                            <span>{method}</span>
                            <span>{value}</span>
                          </div>
                          <div className="h-2 rounded-full bg-zinc-200">
                            <div className="h-2 rounded-full bg-zinc-900" style={{ width: `${width}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <h3 className="text-sm font-semibold text-zinc-900">Module Coverage</h3>
                  <ul className="mt-3 space-y-2 text-sm text-zinc-700">
                    {moduleHealth.map((module) => (
                      <li key={module.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                        <span>{module.name}</span>
                        <span className="font-semibold text-zinc-900">{module.actionCount}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ) : null}

          {activePanel === "activity" ? (
            <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.08)]">
              <h2 className="text-xl font-semibold text-zinc-900">Activity Timeline</h2>
              <p className="mt-1 text-sm text-zinc-600">Recent operational events and endpoint execution updates.</p>

              <div className="mt-4 space-y-3">
                {activityLog.map((entry) => (
                  <article key={entry.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-zinc-900">{entry.title}</p>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${activityTone(entry.status)}`}>
                          {entry.status.toUpperCase()}
                        </span>
                        <span className="text-xs text-zinc-500">{entry.timestamp}</span>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-zinc-700">{entry.detail}</p>
                  </article>
                ))}
              </div>
            </article>
          ) : null}
        </div>

        <aside className="space-y-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] xl:sticky xl:top-5 xl:h-fit">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Execution Context</h2>
            <p className="mt-1 text-sm text-zinc-600">Persisted locally for secure and rapid role operations.</p>
          </div>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Backend API Base URL</span>
            <input
              value={apiBaseUrl}
              onChange={(event) => setApiBaseUrl(event.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:bg-white"
              placeholder="http://localhost:5000"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">JWT Token</span>
            <textarea
              value={token}
              onChange={(event) => setToken(event.target.value)}
              rows={6}
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 outline-none transition focus:border-zinc-500 focus:bg-white"
              placeholder="Paste Bearer token value only"
            />
          </label>

          <div>
            <button
              type="button"
              onClick={() => setToken("")}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-100"
            >
              Clear Token
            </button>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Run Summary</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-white px-2 py-3">
                <p className="text-lg font-semibold text-zinc-900">{runCount}</p>
                <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Executed</p>
              </div>
              <div className="rounded-xl bg-white px-2 py-3">
                <p className="text-lg font-semibold text-zinc-900">{successCount}</p>
                <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Success</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-950 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Latest Response</p>
            {latestAction ? (
              <>
                <p className="mt-2 text-sm font-semibold text-zinc-100">{latestAction.label}</p>
                {latestState?.status ? (
                  <p className="mt-1 text-xs text-zinc-400">HTTP {latestState.status} • {latestState.durationMs ?? 0} ms</p>
                ) : null}
                <pre className="mt-3 max-h-56 overflow-auto rounded-xl bg-zinc-900 px-3 py-2 text-[11px] text-zinc-100">
                  {latestState?.payload !== undefined
                    ? prettyPrint(latestState.payload)
                    : "Run any operation to inspect response payload."}
                </pre>
              </>
            ) : (
              <p className="mt-2 text-xs text-zinc-300">No request has been executed in this session.</p>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
