"use client";

import { useEffect, useMemo, useState } from "react";
import type { ActionBlueprint, RoleBlueprint } from "@/lib/role-blueprints";

type ActionState = {
  loading: boolean;
  status?: number;
  ok?: boolean;
  durationMs?: number;
  payload?: unknown;
  error?: string;
};

type SidebarSection = {
  id: string;
  title: string;
  detail: string;
  actionIds: string[];
};

const TOKEN_KEY = "stratos.jwtToken";
const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

function prettyPrint(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Unable to render response.";
  }
}

function buildSections(role: RoleBlueprint): SidebarSection[] {
  if (role.slug !== "admin") {
    return [
      {
        id: "operations",
        title: "Operations",
        detail: "Run tasks for this role",
        actionIds: role.actions.map((action) => action.id),
      },
    ];
  }

  return [
    {
      id: "configuration",
      title: "Configuration",
      detail: "Semester and policy setup",
      actionIds: ["admin-config-get", "admin-config-set"],
    },
    {
      id: "ingestion",
      title: "Ingestion",
      detail: "Students, faculty, subjects, timetable",
      actionIds: [
        "admin-ingest-students",
        "admin-ingest-faculty",
        "admin-ingest-subjects",
        "admin-ingest-timetable",
      ],
    },
    {
      id: "semester",
      title: "Semester Progression",
      detail: "Promotion and transition controls",
      actionIds: ["admin-progress", "admin-config-get"],
    },
    {
      id: "exams",
      title: "Exam Planning",
      detail: "Seating and invigilation setup",
      actionIds: ["admin-exam-seating", "admin-invigilation"],
    },
    {
      id: "notices",
      title: "Notices",
      detail: "Create and review notices",
      actionIds: ["admin-notice-create", "admin-notice-ai", "admin-notice-list"],
    },
    {
      id: "records",
      title: "Records",
      detail: "Faculty, students, alumni and analytics",
      actionIds: ["admin-faculty-list", "admin-students-list", "admin-alumni-list", "admin-analytics"],
    },
  ];
}

export default function RoleWorkspace({ role }: { role: RoleBlueprint }) {
  const actionById = useMemo(() => {
    return role.actions.reduce<Record<string, ActionBlueprint>>((acc, action) => {
      acc[action.id] = action;
      return acc;
    }, {});
  }, [role.actions]);

  const sections = useMemo(() => buildSections(role), [role]);
  const [selectedSectionId, setSelectedSectionId] = useState(sections[0]?.id || "operations");
  const [token, setToken] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [bodyMap, setBodyMap] = useState<Record<string, string>>({});
  const [fileMap, setFileMap] = useState<Record<string, File | null>>({});
  const [actionState, setActionState] = useState<Record<string, ActionState>>({});

  useEffect(() => {
    const storedToken = window.localStorage.getItem(TOKEN_KEY) || "";
    setToken(storedToken);

    const nextBodyMap = role.actions.reduce<Record<string, string>>((acc, action) => {
      acc[action.id] = action.body ? JSON.stringify(action.body, null, 2) : "";
      return acc;
    }, {});

    setBodyMap(nextBodyMap);
    setFileMap({});
    setActionState({});
    setSearchQuery("");
    setSelectedSectionId(sections[0]?.id || "operations");
  }, [role.actions, sections]);

  const selectedSection = sections.find((section) => section.id === selectedSectionId) || sections[0];

  const visibleActions = useMemo(() => {
    if (!selectedSection) return [];
    const actions = selectedSection.actionIds
      .map((id) => actionById[id])
      .filter((action): action is ActionBlueprint => Boolean(action));

    const query = searchQuery.trim().toLowerCase();
    if (!query) return actions;

    return actions.filter((action) => {
      return (
        action.label.toLowerCase().includes(query) ||
        action.description.toLowerCase().includes(query)
      );
    });
  }, [actionById, searchQuery, selectedSection]);

  async function runAction(action: ActionBlueprint): Promise<void> {
    if (!token.trim()) {
      setActionState((prev) => ({
        ...prev,
        [action.id]: {
          loading: false,
          error: "Please login first.",
        },
      }));
      return;
    }

    const bodyText = bodyMap[action.id] || "";
    const isMultipart = action.transport === "multipart";
    const selectedFile = fileMap[action.id] || null;
    let parsedBody: Record<string, unknown> | undefined;

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
            error: "Please provide valid JSON.",
          },
        }));
        return;
      }
    }

    if (isMultipart && !selectedFile) {
      setActionState((prev) => ({
        ...prev,
        [action.id]: {
          loading: false,
          error: "Please attach the required CSV file.",
        },
      }));
      return;
    }

    setActionState((prev) => ({
      ...prev,
      [action.id]: {
        loading: true,
      },
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
              baseUrl: DEFAULT_BASE_URL,
              path: action.path,
              method: action.method,
              token: token.trim(),
              bodyText,
            }),
          });
        }

        const formData = new FormData();
        formData.set("baseUrl", DEFAULT_BASE_URL);
        formData.set("path", action.path);
        formData.set("method", action.method);
        formData.set("fieldsJson", JSON.stringify(parsedBody || {}));
        formData.set("fileFieldName", action.fileFieldName || "file");
        formData.set("token", token.trim());
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
        data: unknown;
        error?: string;
      };

      setActionState((prev) => ({
        ...prev,
        [action.id]: {
          loading: false,
          ok: response.ok && proxyPayload.ok,
          status: proxyPayload.status,
          durationMs: proxyPayload.durationMs,
          payload: proxyPayload.data,
          error: response.ok ? undefined : proxyPayload.error || "Request failed.",
        },
      }));
    } catch (error) {
      setActionState((prev) => ({
        ...prev,
        [action.id]: {
          loading: false,
          error: error instanceof Error ? error.message : "Unknown error.",
        },
      }));
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[260px_1fr]">
      <aside className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] xl:sticky xl:top-5 xl:h-fit">
        <p className="px-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
          {role.roleName} Functions
        </p>
        <div className="mt-3 space-y-2">
          {sections.map((section) => {
            const selected = selectedSectionId === section.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setSelectedSectionId(section.id)}
                className={`w-full rounded-xl px-3 py-3 text-left transition ${
                  selected ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                <p className="text-sm font-semibold">{section.title}</p>
                <p className={`mt-1 text-xs ${selected ? "text-zinc-300" : "text-zinc-500"}`}>
                  {section.detail}
                </p>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">{selectedSection?.title || "Operations"}</h1>
            <p className="mt-1 text-sm text-zinc-600">{selectedSection?.detail}</p>
          </div>
          <label className="w-full max-w-md">
            <span className="sr-only">Search functionality</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search functionality"
              className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:bg-white"
            />
          </label>
        </div>

        {!token ? (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Please login from the launcher before using this workspace.
          </p>
        ) : null}

        <div className="mt-5 space-y-4">
          {visibleActions.map((action) => {
            const state = actionState[action.id];
            const bodyText = bodyMap[action.id] || "";
            const selectedFile = fileMap[action.id];

            return (
              <article key={action.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <h2 className="text-lg font-semibold text-zinc-900">{action.label}</h2>
                <p className="mt-1 text-sm text-zinc-600">{action.description}</p>

                {action.method !== "GET" && action.method !== "DELETE" ? (
                  <label className="mt-4 block">
                    <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Details</span>
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
                    {state?.loading ? "Running..." : "Execute"}
                  </button>

                  {state?.ok !== undefined ? (
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${state.ok ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                      {state.ok ? "Success" : "Failed"}
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

          {visibleActions.length === 0 ? (
            <p className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-600">
              No functionality found in this section.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
