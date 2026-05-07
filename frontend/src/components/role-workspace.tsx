"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
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

type FieldSpec = {
  key: string;
  label: string;
  sample: unknown;
  inputType: "text" | "number" | "date" | "boolean" | "list";
};

type YearProgressionRow = {
  academic_year: "1st" | "2nd" | "3rd" | "4th";
  odd_semester: number;
  even_semester: number;
  odd_strength: number;
  even_strength: number;
  odd_blocked: number;
  even_blocked: number;
  year_back_count: number;
  next_action_label: string;
};

type ProgressionBoard = {
  active_semester_type: "ODD" | "EVEN";
  years: YearProgressionRow[];
};

const TOKEN_KEY = "stratos.jwtToken";
const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";
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

function toLabel(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isPrimitive(value: unknown): value is string | number | boolean {
  const type = typeof value;
  return type === "string" || type === "number" || type === "boolean";
}

function isPrimitiveList(value: unknown): value is Array<string | number | boolean> {
  return Array.isArray(value) && value.every((entry) => isPrimitive(entry));
}

function buildFieldSpecs(action: ActionBlueprint): FieldSpec[] {
  if (!action.body) return [];

  return Object.entries(action.body).reduce<FieldSpec[]>((acc, [key, value]) => {
    if (typeof value === "number") {
      acc.push({ key, label: toLabel(key), sample: value, inputType: "number" });
      return acc;
    }
    if (typeof value === "boolean") {
      acc.push({ key, label: toLabel(key), sample: value, inputType: "boolean" });
      return acc;
    }
    if (typeof value === "string") {
      const looksLikeDate = /^\d{4}-\d{2}-\d{2}$/.test(value);
      acc.push({ key, label: toLabel(key), sample: value, inputType: looksLikeDate ? "date" : "text" });
      return acc;
    }
    if (isPrimitiveList(value)) {
      acc.push({ key, label: toLabel(key), sample: value, inputType: "list" });
      return acc;
    }
    return acc;
  }, []);
}

function createFieldValueMap(action: ActionBlueprint): Record<string, string> {
  const fields = buildFieldSpecs(action);
  const values: Record<string, string> = {};

  for (const field of fields) {
    const sample = field.sample;
    values[field.key] = isPrimitiveList(sample) ? sample.join(", ") : String(sample ?? "");
  }

  return values;
}

function parseFieldValue(field: FieldSpec, rawValue: string): unknown {
  if (field.inputType === "number") {
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (field.inputType === "boolean") {
    return rawValue === "true";
  }

  if (field.inputType === "list") {
    const sample = Array.isArray(field.sample) ? field.sample : [];
    const list = rawValue
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (!sample.length) return list;

    if (typeof sample[0] === "number") {
      return list.map((entry) => {
        const parsed = Number(entry);
        return Number.isFinite(parsed) ? parsed : 0;
      });
    }

    if (typeof sample[0] === "boolean") {
      return list.map((entry) => entry.toLowerCase() === "true");
    }

    return list;
  }

  return rawValue;
}

function renderPayloadData(payload: unknown): ReactNode {
  if (payload === null || payload === undefined) {
    return <span className="text-zinc-500">No data returned.</span>;
  }

  if (typeof payload === "string" || typeof payload === "number" || typeof payload === "boolean") {
    return <span className="text-zinc-800">{String(payload)}</span>;
  }

  if (Array.isArray(payload)) {
    if (!payload.length) {
      return <span className="text-zinc-500">No records found.</span>;
    }

    return (
      <div className="space-y-2">
        {payload.map((item, index) => (
          <div key={`payload-item-${index}`} className="rounded-xl border border-zinc-200 bg-white p-3">
            {renderPayloadData(item)}
          </div>
        ))}
      </div>
    );
  }

  if (typeof payload === "object") {
    const entries = Object.entries(payload as Record<string, unknown>);
    if (!entries.length) {
      return <span className="text-zinc-500">No fields available.</span>;
    }

    return (
      <div className="grid gap-2 md:grid-cols-2">
        {entries.map(([key, value]) => (
          <div key={key} className="rounded-xl border border-zinc-200 bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{toLabel(key)}</p>
            <div className="mt-1 text-sm">{renderPayloadData(value)}</div>
          </div>
        ))}
      </div>
    );
  }

  return <span className="text-zinc-500">Unsupported response type.</span>;
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
  const [fieldValueMap, setFieldValueMap] = useState<Record<string, Record<string, string>>>({});
  const [fileMap, setFileMap] = useState<Record<string, File | null>>({});
  const [csvFileMap, setCsvFileMap] = useState<Record<string, File | null>>({});
  const [actionState, setActionState] = useState<Record<string, ActionState>>({});
  const [progressionBoard, setProgressionBoard] = useState<ProgressionBoard | null>(null);
  const [progressionLoading, setProgressionLoading] = useState(false);
  const [promotingYear, setPromotingYear] = useState<YearProgressionRow["academic_year"] | null>(null);
  const [progressionFeedback, setProgressionFeedback] = useState<string | null>(null);
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

    const nextFieldValueMap = role.actions.reduce<Record<string, Record<string, string>>>((acc, action) => {
      acc[action.id] = createFieldValueMap(action);
      return acc;
    }, {});

    setBodyMap(nextBodyMap);
    setFieldValueMap(nextFieldValueMap);
    setFileMap({});
    setCsvFileMap({});
    setActionState({});
    setProgressionBoard(null);
    setProgressionLoading(false);
    setPromotingYear(null);
    setProgressionFeedback(null);
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

  const sendJson = useCallback(async (
    path: string,
    method: ActionBlueprint["method"],
    bodyText = ""
  ): Promise<ProxyEnvelope> => {
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
  }, [token]);

  const sendMultipart = useCallback(async (
    action: ActionBlueprint,
    selectedFile: File,
    parsedBody: Record<string, unknown>
  ): Promise<ProxyEnvelope> => {
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
  }, [token]);

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

      const fields = buildFieldSpecs(action);
      if (fields.length && typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
        const payloadObject = payload as Record<string, unknown>;
        setFieldValueMap((prev) => {
          const next = { ...(prev[action.id] || {}) };
          for (const field of fields) {
            const value = payloadObject[field.key];
            if (value === undefined || value === null) continue;
            next[field.key] = Array.isArray(value) ? value.map(String).join(", ") : String(value);
          }
          return {
            ...prev,
            [action.id]: next,
          };
        });
      }

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

    let bodyText = bodyMap[action.id] || "";
    const isMultipart = action.transport === "multipart";
    const selectedFile = fileMap[action.id] || null;
    let parsedBody: Record<string, unknown> = {};

    if (action.method !== "GET" && action.method !== "DELETE") {
      if (bodyText.trim()) {
        try {
          const candidate = JSON.parse(bodyText);
          if (typeof candidate === "object" && candidate !== null && !Array.isArray(candidate)) {
            parsedBody = candidate as Record<string, unknown>;
          }
        } catch {
          parsedBody = {};
        }
      }

      const fields = buildFieldSpecs(action);
      const values = fieldValueMap[action.id] || {};

      if (fields.length) {
        for (const field of fields) {
          parsedBody[field.key] = parseFieldValue(field, values[field.key] ?? "");
        }
      }

      bodyText = Object.keys(parsedBody).length ? JSON.stringify(parsedBody) : "";
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

  const loadProgressionBoard = useCallback(async (): Promise<void> => {
    if (!token.trim()) return;

    setProgressionLoading(true);
    try {
      const result = await sendJson("/api/admin/batch-progression/status", "GET");
      if (!result.ok) {
        setProgressionFeedback(`Unable to load progression board (${result.status}).`);
        return;
      }

      const root = result.data as { data?: ProgressionBoard };
      if (root?.data?.years) {
        setProgressionBoard(root.data);
      }
      setProgressionFeedback(null);
    } catch (error) {
      setProgressionFeedback(error instanceof Error ? error.message : "Unable to load progression board.");
    } finally {
      setProgressionLoading(false);
    }
  }, [sendJson, token]);

  async function promoteYear(row: YearProgressionRow): Promise<void> {
    if (!token.trim() || !progressionBoard) {
      setProgressionFeedback("Please login first.");
      return;
    }

    setPromotingYear(row.academic_year);
    try {
      const result = await sendJson(
        "/api/admin/batch-progression/promote-year",
        "POST",
        JSON.stringify({
          academic_year: row.academic_year,
          semester_type: progressionBoard.active_semester_type,
        })
      );

      if (!result.ok) {
        setProgressionFeedback(`Progression failed for ${row.academic_year} (${result.status}).`);
        return;
      }

      const data = (result.data as { data?: Record<string, unknown> })?.data;
      const progressed = Number(data?.progressed ?? 0);
      const alumniTransitions = Number(data?.alumniTransitions ?? 0);
      const blockedSkipped = Number(data?.blockedSkipped ?? 0);
      const yearBackSkipped = Number(data?.yearBackSkipped ?? 0);

      setProgressionFeedback(
        `${row.academic_year}: ${progressed} progressed, ${alumniTransitions} moved to alumni, ${blockedSkipped} blocked by KT/SUPPLI, ${yearBackSkipped} year-back or out-of-cycle.`
      );

      await loadProgressionBoard();

      const analyticsAction = actionById["admin-analytics"];
      if (analyticsAction) {
        await runAction(analyticsAction);
      }
    } catch (error) {
      setProgressionFeedback(error instanceof Error ? error.message : "Year progression failed.");
    } finally {
      setPromotingYear(null);
    }
  }

  useEffect(() => {
    if (role.slug !== "admin") return;
    if (selectedSectionId !== "semester") return;
    if (!token.trim()) return;
    void loadProgressionBoard();
  }, [loadProgressionBoard, role.slug, selectedSectionId, token]);

  const analyticsBars = useMemo(() => {
    return extractAnalyticsBars(actionState["admin-analytics"]?.payload);
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
            <h2 className="text-lg font-semibold text-zinc-900">Semester Progression Board</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Manage each academic year separately. Odd cycle promotes to next semester, even cycle promotes to next year, and Semester 8 even cycle moves eligible students to alumni.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void loadProgressionBoard()}
                disabled={progressionLoading}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-500"
              >
                {progressionLoading ? "Refreshing..." : "Refresh Board"}
              </button>
              {progressionBoard ? (
                <span
                  className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-800"
                >
                  Current Cycle: {progressionBoard.active_semester_type}
                </span>
              ) : null}
            </div>

            {progressionFeedback ? (
              <p className="mt-4 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                {progressionFeedback}
              </p>
            ) : null}

            {progressionBoard ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {progressionBoard.years.map((row) => {
                  const isBusy = promotingYear === row.academic_year;
                  return (
                    <div key={row.academic_year} className="rounded-2xl border border-zinc-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-base font-semibold text-zinc-900">{row.academic_year} Year</h3>
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                          {row.next_action_label}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-2">
                          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Sem {row.odd_semester}</p>
                          <p className="mt-1 font-semibold text-zinc-900">{row.odd_strength} students</p>
                          <p className="text-xs text-rose-700">Blocked: {row.odd_blocked}</p>
                        </div>
                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-2">
                          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Sem {row.even_semester}</p>
                          <p className="mt-1 font-semibold text-zinc-900">{row.even_strength} students</p>
                          <p className="text-xs text-rose-700">Blocked: {row.even_blocked}</p>
                        </div>
                      </div>

                      <p className="mt-3 text-xs text-amber-700">Year Back: {row.year_back_count}</p>

                      <button
                        type="button"
                        onClick={() => void promoteYear(row)}
                        disabled={isBusy || progressionLoading}
                        className="mt-3 w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-500"
                      >
                        {isBusy ? "Processing..." : row.next_action_label}
                      </button>
                    </div>
                  );
                })}
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
            const selectedFile = fileMap[action.id];
            const csvInputFile = csvFileMap[action.id];
            const needsDetailsInput =
              action.method !== "GET" &&
              action.method !== "DELETE" &&
              !(action.transport === "multipart" && !action.body);
            const fieldSpecs = buildFieldSpecs(action);
            const hasComplexBody = Boolean(action.body) && fieldSpecs.length !== Object.keys(action.body || {}).length;

            return (
              <article key={action.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <h2 className="text-lg font-semibold text-zinc-900">{action.label}</h2>
                <p className="mt-1 text-sm text-zinc-600">{action.description}</p>

                {needsDetailsInput ? (
                  <>
                    {fieldSpecs.length ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {fieldSpecs.map((field) => {
                          const fieldValue = fieldValueMap[action.id]?.[field.key] || "";
                          const inputType = field.inputType === "number" || field.inputType === "date" ? field.inputType : "text";

                          return (
                            <label key={field.key}>
                              <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                                {field.label}
                              </span>
                              {field.inputType === "boolean" ? (
                                <select
                                  value={fieldValue || "false"}
                                  onChange={(event) =>
                                    setFieldValueMap((prev) => ({
                                      ...prev,
                                      [action.id]: {
                                        ...(prev[action.id] || {}),
                                        [field.key]: event.target.value,
                                      },
                                    }))
                                  }
                                  className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500"
                                >
                                  <option value="true">True</option>
                                  <option value="false">False</option>
                                </select>
                              ) : (
                                <input
                                  type={inputType}
                                  value={fieldValue}
                                  onChange={(event) =>
                                    setFieldValueMap((prev) => ({
                                      ...prev,
                                      [action.id]: {
                                        ...(prev[action.id] || {}),
                                        [field.key]: event.target.value,
                                      },
                                    }))
                                  }
                                  placeholder={field.inputType === "list" ? "Value 1, Value 2" : "Enter value"}
                                  className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500"
                                />
                              )}
                            </label>
                          );
                        })}
                      </div>
                    ) : null}

                    {hasComplexBody ? (
                      <p className="mt-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600">
                        This action includes structured data. Use CSV Assist below to fill it quickly without JSON editing.
                      </p>
                    ) : null}

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
                          Apply CSV Data
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
                  <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Response</p>
                    <div className="mt-2">{renderPayloadData(state.payload)}</div>
                  </div>
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
