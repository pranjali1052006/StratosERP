"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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

type NoticeMode = "manual" | "ai";

type ProxyEnvelope = {
  ok: boolean;
  status: number;
  durationMs: number;
  data: unknown;
  error?: string;
};

const TOKEN_KEY = "stratos.jwtToken";
const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";
const PIE_COLORS = ["#334155", "#22c55e", "#f97316", "#06b6d4", "#a855f7", "#ef4444"];

const CSV_TEMPLATES: Record<string, string> = {
  "admin-ingest-students":
    "uid,email_id,current_semester,academic_year,password\n2023-CSE-A-01-2027,student1@tcetmumbai.in,5,3rd,Welcome@123\n",
  "admin-ingest-faculty":
    "name,email_id,designation_role,is_admin,is_hod,password\nProf. A Patil,apatil@tcetmumbai.in,Subject Incharge,false,false,Faculty@123\n",
  "admin-ingest-subjects":
    "name,semester_level,has_lab,lab_marks_weight\nData Structures,3,true,30\n",
  "admin-ingest-timetable":
    "day_of_week,start_time,end_time,subject_id,faculty_id\nMonday,09:00:00,10:00:00,1,1\n",
  "admin-config-set": "active_semester_type,start_date,end_date\nODD,2026-07-15,2026-12-10\n",
  "admin-exam-seating": "room,capacity\nA-301,60\nA-302,48\n",
  "admin-invigilation": "exam_date\n2026-05-25\n",
  "admin-notice-create":
    "title,target_audience,ai_filter_tags\nInternal assessment schedule updated,INSTITUTE,ACADEMIC|IMPORTANT\n",
  "admin-notice-ai":
    "context,target_audience\nSend low attendance warning to Semester 5 students below 75% attendance.,INSTITUTE\n",
};

function prettyPrint(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Unable to render response.";
  }
}

function escapeCsvCell(value: unknown): string {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsvText(text: string): Array<Record<string, string>> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = values[index] ?? "";
      return acc;
    }, {});
  });
}

function coerceValue(value: string): unknown {
  const normalized = value.trim();
  if (!normalized) return "";

  if (normalized.toLowerCase() === "true") return true;
  if (normalized.toLowerCase() === "false") return false;

  const asNumber = Number(normalized);
  if (!Number.isNaN(asNumber) && /^-?\d+(\.\d+)?$/.test(normalized)) {
    return asNumber;
  }

  return normalized;
}

function convertRowsToPayload(actionId: string, rows: Array<Record<string, string>>): Record<string, unknown> {
  if (!rows.length) return {};

  if (actionId === "admin-config-set") {
    const row = rows[0];
    return {
      active_semester_type: row.active_semester_type || "ODD",
      start_date: row.start_date || "",
      end_date: row.end_date || "",
    };
  }

  if (actionId === "admin-exam-seating") {
    return {
      classrooms: rows.map((row) => ({
        room: row.room,
        capacity: Number(row.capacity || 0),
      })),
    };
  }

  if (actionId === "admin-invigilation") {
    return {
      exam_date: rows[0].exam_date || "",
    };
  }

  if (actionId === "admin-notice-create") {
    const row = rows[0];
    return {
      title: row.title || "",
      target_audience: row.target_audience || "INSTITUTE",
      ai_filter_tags: (row.ai_filter_tags || "")
        .split(/[|;,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    };
  }

  if (actionId === "admin-notice-ai") {
    const row = rows[0];
    return {
      context: row.context || "",
      target_audience: row.target_audience || "INSTITUTE",
    };
  }

  const convertedRows = rows.map((row) => {
    return Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
      acc[key] = coerceValue(value);
      return acc;
    }, {});
  });

  return convertedRows.length === 1 ? convertedRows[0] : { records: convertedRows };
}

function buildBodyTemplate(action: ActionBlueprint): string {
  if (!action.body) return "";

  const keys = Object.keys(action.body);
  if (!keys.length) return "";

  const values = keys.map((key) => {
    const raw = action.body?.[key as keyof typeof action.body];
    return typeof raw === "object" ? JSON.stringify(raw) : String(raw ?? "");
  });

  return `${keys.join(",")}\n${values.map(escapeCsvCell).join(",")}\n`;
}

function buildSections(role: RoleBlueprint): SidebarSection[] {
  if (role.slug === "hod") {
    return [
      {
        id: "insights",
        title: "Insights",
        detail: "Department performance and student visibility",
        actionIds: ["hod-analytics", "hod-track-student", "hod-alumni"],
      },
      {
        id: "faculty-management",
        title: "Faculty Management",
        detail: "Roster, role assignment and subject mapping",
        actionIds: ["hod-faculty", "hod-subjects", "hod-assign-subject", "hod-assign-role"],
      },
      {
        id: "operations",
        title: "Operational Controls",
        detail: "Leave planning and escalation handling",
        actionIds: ["hod-leave", "hod-leave-log", "hod-escalated-grievances", "hod-resolve-grievance"],
      },
      {
        id: "communication",
        title: "Communication",
        detail: "Manual and AI-assisted branch notices",
        actionIds: ["hod-notice-create", "hod-notice-ai", "hod-notice-list"],
      },
    ];
  }

  if (role.slug === "class-incharge") {
    return [
      {
        id: "class-analytics",
        title: "Class Analytics",
        detail: "Performance overview and student risk monitoring",
        actionIds: ["ci-analytics", "ci-risk", "ci-students"],
      },
      {
        id: "student-support",
        title: "Student Support",
        detail: "Portfolio review and PTM preparation",
        actionIds: ["ci-portfolio", "ci-ptm"],
      },
      {
        id: "progression",
        title: "Progression",
        detail: "Readiness tracking for semester advancement",
        actionIds: ["ci-progression-readiness"],
      },
      {
        id: "communication",
        title: "Communication",
        detail: "Class notice publishing and review",
        actionIds: ["ci-notice", "ci-notice-list"],
      },
    ];
  }

  if (role.slug === "subject-incharge") {
    return [
      {
        id: "subject-control",
        title: "Subject Control",
        detail: "Subject list, active slot and attendance capture",
        actionIds: ["si-subjects", "si-slot", "si-attendance", "si-attendance-records"],
      },
      {
        id: "evaluation",
        title: "Evaluation",
        detail: "Marks entry and performance analytics",
        actionIds: ["si-marks", "si-suppli-marks", "si-subject-marks", "si-subject-analytics"],
      },
      {
        id: "lecture-planning",
        title: "Lecture Planning",
        detail: "Lecture logs and syllabus pacing support",
        actionIds: ["si-lecture", "si-lecture-logs", "si-analysis"],
      },
      {
        id: "materials",
        title: "Study Materials",
        detail: "Upload classroom material for students",
        actionIds: ["si-upload-material"],
      },
    ];
  }

  if (role.slug === "practical-teacher") {
    return [
      {
        id: "sessions",
        title: "Session Management",
        detail: "Create, complete and lock practical sessions",
        actionIds: ["pt-sessions", "pt-create-session", "pt-complete-session", "pt-lock-session"],
      },
      {
        id: "attendance-marks",
        title: "Attendance & Marks",
        detail: "Record and review attendance and evaluation",
        actionIds: ["pt-attendance", "pt-attendance-view", "pt-marks", "pt-marks-view"],
      },
      {
        id: "lab-setup",
        title: "Lab Setup",
        detail: "Manage experiments and batches",
        actionIds: ["pt-experiments", "pt-create-experiment", "pt-batches", "pt-create-batch"],
      },
      {
        id: "submissions",
        title: "Submissions",
        detail: "Track and update practical submissions",
        actionIds: ["pt-submission", "pt-submissions-view"],
      },
    ];
  }

  if (role.slug === "teacher-guardian") {
    return [
      {
        id: "mentee-overview",
        title: "Mentee Overview",
        detail: "Mentee list, portfolio and improvement tracking",
        actionIds: ["tg-mentees", "tg-portfolio", "tg-report"],
      },
      {
        id: "aicte-management",
        title: "AICTE Points",
        detail: "Award points and check activity history",
        actionIds: ["tg-aicte-award", "tg-aicte-points"],
      },
      {
        id: "grievance-support",
        title: "Grievance Support",
        detail: "Review and resolve assigned grievances",
        actionIds: ["tg-grievances", "tg-resolve"],
      },
      {
        id: "communication",
        title: "Communication",
        detail: "Notices relevant to mentees",
        actionIds: ["tg-notices"],
      },
    ];
  }

  if (role.slug === "student") {
    return [
      {
        id: "academic-view",
        title: "Academic View",
        detail: "Dashboard, timetable and lab performance",
        actionIds: ["st-dashboard", "st-timetable", "st-lab"],
      },
      {
        id: "guidance-support",
        title: "Guidance & Support",
        detail: "Faculty locator and grievance support",
        actionIds: ["st-locator", "st-grievance-submit", "st-grievances"],
      },
      {
        id: "notices-materials",
        title: "Notices & Materials",
        detail: "Notices and downloadable study resources",
        actionIds: ["st-notices", "st-materials", "st-material-download"],
      },
    ];
  }

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
      detail: "Increase semester for eligible students",
      actionIds: ["admin-config-get"],
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
      detail: "Manual or AI-assisted notice publishing",
      actionIds: ["admin-notice-list"],
    },
    {
      id: "records",
      title: "Records",
      detail: "Faculty, students and alumni data",
      actionIds: ["admin-faculty-list", "admin-students-list", "admin-alumni-list"],
    },
  ];
}

function pickDataObject(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;

  const root = payload as Record<string, unknown>;
  const data = root.data;

  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }

  return root;
}

function extractAnalyticsBars(payload: unknown): Array<{ name: string; value: number }> {
  const data = pickDataObject(payload);
  if (!data) return [];

  const mapping: Array<{ key: string; label: string }> = [
    { key: "total_students", label: "Students" },
    { key: "total_faculty", label: "Faculty" },
    { key: "total_subjects", label: "Subjects" },
    { key: "kt_records", label: "KT" },
    { key: "suppli_records", label: "SUPPLI" },
    { key: "alumni_count", label: "Alumni" },
  ];

  return mapping
    .map((item) => ({
      name: item.label,
      value: Number(data[item.key] ?? 0),
    }))
    .filter((entry) => Number.isFinite(entry.value));
}

function extractProgressionSlices(payload: unknown): Array<{ name: string; value: number }> {
  const data = pickDataObject(payload);
  if (!data) return [];

  const progressed = Number(data.progressed ?? 0);
  const alumniTransitions = Number(data.alumniTransitions ?? 0);

  return [
    { name: "Semester Increased", value: Number.isFinite(progressed) ? progressed : 0 },
    { name: "Moved to Alumni", value: Number.isFinite(alumniTransitions) ? alumniTransitions : 0 },
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
  const [csvFileMap, setCsvFileMap] = useState<Record<string, File | null>>({});
  const [actionState, setActionState] = useState<Record<string, ActionState>>({});
  const [noticeMode, setNoticeMode] = useState<NoticeMode>("manual");
  const [manualNotice, setManualNotice] = useState({
    title: "",
    target_audience: "INSTITUTE",
    ai_filter_tags: "",
  });
  const [aiNotice, setAiNotice] = useState({
    context: "",
    target_audience: "INSTITUTE",
  });
  const [noticeSubmitting, setNoticeSubmitting] = useState(false);
  const [noticeFeedback, setNoticeFeedback] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(TOKEN_KEY) || "";
    setToken(storedToken);

    const nextBodyMap = role.actions.reduce<Record<string, string>>((acc, action) => {
      acc[action.id] = action.body ? JSON.stringify(action.body, null, 2) : "";
      return acc;
    }, {});

    setBodyMap(nextBodyMap);
    setFileMap({});
    setCsvFileMap({});
    setActionState({});
    setSearchQuery("");
    setSelectedSectionId(sections[0]?.id || "operations");
    setNoticeMode("manual");
    setManualNotice({ title: "", target_audience: "INSTITUTE", ai_filter_tags: "" });
    setAiNotice({ context: "", target_audience: "INSTITUTE" });
    setNoticeFeedback(null);
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

  async function sendJson(path: string, method: ActionBlueprint["method"], bodyText = ""): Promise<ProxyEnvelope> {
    const response = await fetch("/api/proxy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        baseUrl: DEFAULT_BASE_URL,
        path,
        method,
        token: token.trim(),
        bodyText,
      }),
    });

    const payload = (await response.json()) as ProxyEnvelope;
    return {
      ...payload,
      ok: response.ok && payload.ok,
    };
  }

  async function sendMultipart(
    action: ActionBlueprint,
    selectedFile: File,
    parsedBody: Record<string, unknown>
  ): Promise<ProxyEnvelope> {
    const formData = new FormData();
    formData.set("baseUrl", DEFAULT_BASE_URL);
    formData.set("path", action.path);
    formData.set("method", action.method);
    formData.set("fieldsJson", JSON.stringify(parsedBody));
    formData.set("fileFieldName", action.fileFieldName || "file");
    formData.set("token", token.trim());
    formData.set("file", selectedFile);

    const response = await fetch("/api/proxy", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json()) as ProxyEnvelope;
    return {
      ...payload,
      ok: response.ok && payload.ok,
    };
  }

  function downloadTemplate(action: ActionBlueprint): void {
    const template = CSV_TEMPLATES[action.id] || buildBodyTemplate(action);
    if (!template) {
      setActionState((prev) => ({
        ...prev,
        [action.id]: {
          ...prev[action.id],
          loading: false,
          error: "Template not available for this functionality.",
        },
      }));
      return;
    }

    const blob = new Blob([template], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${action.id}.template.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  async function convertCsvToJson(action: ActionBlueprint): Promise<void> {
    const csvFile = csvFileMap[action.id];
    if (!csvFile) {
      setActionState((prev) => ({
        ...prev,
        [action.id]: {
          ...prev[action.id],
          loading: false,
          error: "Please select a CSV file first.",
        },
      }));
      return;
    }

    try {
      const text = await csvFile.text();
      const rows = parseCsvText(text);
      if (!rows.length) {
        throw new Error("CSV file has no data rows.");
      }

      const payload = convertRowsToPayload(action.id, rows);
      setBodyMap((prev) => ({
        ...prev,
        [action.id]: JSON.stringify(payload, null, 2),
      }));

      setActionState((prev) => ({
        ...prev,
        [action.id]: {
          ...prev[action.id],
          loading: false,
          error: undefined,
        },
      }));
    } catch (error) {
      setActionState((prev) => ({
        ...prev,
        [action.id]: {
          ...prev[action.id],
          loading: false,
          error: error instanceof Error ? error.message : "Unable to parse CSV file.",
        },
      }));
    }
  }

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
    let parsedBody: Record<string, unknown> = {};

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
      const result = isMultipart
        ? await sendMultipart(action, selectedFile as File, parsedBody)
        : await sendJson(action.path, action.method, bodyText);

      setActionState((prev) => ({
        ...prev,
        [action.id]: {
          loading: false,
          ok: result.ok,
          status: result.status,
          durationMs: result.durationMs,
          payload: result.data,
          error: result.ok ? undefined : result.error || "Request failed.",
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

  async function submitNotice(): Promise<void> {
    if (!token.trim()) {
      setNoticeFeedback("Please login first.");
      return;
    }

    const payload =
      noticeMode === "manual"
        ? {
            title: manualNotice.title,
            target_audience: manualNotice.target_audience,
            ai_filter_tags: manualNotice.ai_filter_tags
              .split(/[|;,]/)
              .map((tag) => tag.trim())
              .filter(Boolean),
          }
        : {
            context: aiNotice.context,
            target_audience: aiNotice.target_audience,
          };

    const path = noticeMode === "manual" ? "/api/admin/notices" : "/api/admin/notices/ai";

    setNoticeSubmitting(true);
    setNoticeFeedback(null);

    try {
      const result = await sendJson(path, "POST", JSON.stringify(payload));
      if (!result.ok) {
        setNoticeFeedback(`Notice submission failed (${result.status}).`);
        return;
      }

      setNoticeFeedback("Notice submitted successfully.");

      const noticeListAction = actionById["admin-notice-list"];
      if (noticeListAction) {
        await runAction(noticeListAction);
      }
    } catch (error) {
      setNoticeFeedback(error instanceof Error ? error.message : "Failed to submit notice.");
    } finally {
      setNoticeSubmitting(false);
    }
  }

  async function runIncreaseSemester(): Promise<void> {
    const action = actionById["admin-progress"];
    if (!action) return;

    await runAction(action);

    const configAction = actionById["admin-config-get"];
    if (configAction) {
      await runAction(configAction);
    }

    const analyticsAction = actionById["admin-analytics"];
    if (analyticsAction) {
      await runAction(analyticsAction);
    }
  }

  const analyticsBars = useMemo(() => {
    return extractAnalyticsBars(actionState["admin-analytics"]?.payload);
  }, [actionState]);

  const progressionSlices = useMemo(() => {
    return extractProgressionSlices(actionState["admin-progress"]?.payload);
  }, [actionState]);

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

        {selectedSectionId === "semester" ? (
          <article className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <h2 className="text-lg font-semibold text-zinc-900">Increase Semester</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Use this to promote eligible students across the institution in one action.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void runIncreaseSemester()}
                disabled={actionState["admin-progress"]?.loading}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-500"
              >
                {actionState["admin-progress"]?.loading ? "Processing..." : "Increase Semester"}
              </button>
              {actionState["admin-progress"]?.ok !== undefined ? (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    actionState["admin-progress"]?.ok
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {actionState["admin-progress"]?.ok ? "Completed" : "Failed"}
                </span>
              ) : null}
            </div>
            {progressionSlices.some((slice) => slice.value > 0) ? (
              <div className="mt-4 h-72 rounded-2xl border border-zinc-200 bg-white p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={progressionSlices} dataKey="value" nameKey="name" outerRadius={95} label>
                      {progressionSlices.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </article>
        ) : null}

        {selectedSectionId === "records" ? (
          <article className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Live Institutional Metrics</h2>
                <p className="mt-1 text-sm text-zinc-600">Charts below are generated from backend analytics response.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const analyticsAction = actionById["admin-analytics"];
                  if (analyticsAction) void runAction(analyticsAction);
                }}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
              >
                Refresh Metrics
              </button>
            </div>
            {analyticsBars.length > 0 ? (
              <div className="mt-4 h-80 rounded-2xl border border-zinc-200 bg-white p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsBars}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#111827" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600">
                Use Refresh Metrics to load chart data.
              </p>
            )}
          </article>
        ) : null}

        {selectedSectionId === "notices" ? (
          <article className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Notice Composer</h2>
                <p className="mt-1 text-sm text-zinc-600">Choose manual writing or AI draft with Gemini.</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNoticeMode("manual")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    noticeMode === "manual"
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  Manual Notice
                </button>
                <button
                  type="button"
                  onClick={() => setNoticeMode("ai")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    noticeMode === "ai"
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  AI Notice (Gemini)
                </button>
              </div>
            </div>

            {noticeMode === "manual" ? (
              <div className="mt-4 grid gap-3">
                <label>
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Title</span>
                  <input
                    value={manualNotice.title}
                    onChange={(event) =>
                      setManualNotice((prev) => ({
                        ...prev,
                        title: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500"
                    placeholder="Notice title"
                  />
                </label>
                <label>
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Audience</span>
                  <select
                    value={manualNotice.target_audience}
                    onChange={(event) =>
                      setManualNotice((prev) => ({
                        ...prev,
                        target_audience: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500"
                  >
                    <option value="INSTITUTE">INSTITUTE</option>
                    <option value="BRANCH">BRANCH</option>
                  </select>
                </label>
                <label>
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Tags</span>
                  <input
                    value={manualNotice.ai_filter_tags}
                    onChange={(event) =>
                      setManualNotice((prev) => ({
                        ...prev,
                        ai_filter_tags: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500"
                    placeholder="ACADEMIC, IMPORTANT"
                  />
                </label>
              </div>
            ) : (
              <div className="mt-4 grid gap-3">
                <label>
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Context for AI Draft</span>
                  <textarea
                    value={aiNotice.context}
                    onChange={(event) =>
                      setAiNotice((prev) => ({
                        ...prev,
                        context: event.target.value,
                      }))
                    }
                    rows={5}
                    className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500"
                    placeholder="Describe the notice to generate"
                  />
                </label>
                <label>
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Audience</span>
                  <select
                    value={aiNotice.target_audience}
                    onChange={(event) =>
                      setAiNotice((prev) => ({
                        ...prev,
                        target_audience: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500"
                  >
                    <option value="INSTITUTE">INSTITUTE</option>
                    <option value="BRANCH">BRANCH</option>
                  </select>
                </label>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void submitNotice()}
                disabled={noticeSubmitting}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-500"
              >
                {noticeSubmitting ? "Submitting..." : "Publish Notice"}
              </button>
              {noticeFeedback ? (
                <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700">
                  {noticeFeedback}
                </span>
              ) : null}
            </div>
          </article>
        ) : null}

        <div className="mt-5 space-y-4">
          {visibleActions.map((action) => {
            const state = actionState[action.id];
            const bodyText = bodyMap[action.id] || "";
            const selectedFile = fileMap[action.id];
            const csvInputFile = csvFileMap[action.id];
            const needsDetailsInput =
              action.method !== "GET" &&
              action.method !== "DELETE" &&
              !(action.transport === "multipart" && !action.body);

            return (
              <article key={action.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <h2 className="text-lg font-semibold text-zinc-900">{action.label}</h2>
                <p className="mt-1 text-sm text-zinc-600">{action.description}</p>

                {needsDetailsInput ? (
                  <>
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

                    <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3">
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">CSV Assist</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => downloadTemplate(action)}
                          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-100"
                        >
                          Download Template CSV
                        </button>
                        <input
                          type="file"
                          accept=".csv"
                          onChange={(event) =>
                            setCsvFileMap((prev) => ({
                              ...prev,
                              [action.id]: event.target.files?.[0] || null,
                            }))
                          }
                          className="block w-full max-w-xs cursor-pointer rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-900"
                        />
                        <button
                          type="button"
                          onClick={() => void convertCsvToJson(action)}
                          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-700"
                        >
                          Convert CSV to Form Data
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-zinc-500">
                        {csvInputFile ? `Selected: ${csvInputFile.name}` : "No CSV selected for conversion."}
                      </p>
                    </div>
                  </>
                ) : null}

                {action.transport === "multipart" ? (
                  <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">CSV Upload</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => downloadTemplate(action)}
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-100"
                      >
                        Download Template CSV
                      </button>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(event) =>
                          setFileMap((prev) => ({
                            ...prev,
                            [action.id]: event.target.files?.[0] || null,
                          }))
                        }
                        className="block w-full max-w-xs cursor-pointer rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-900"
                      />
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">
                      {selectedFile ? `Selected: ${selectedFile.name}` : "No file selected."}
                    </p>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void runAction(action)}
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
