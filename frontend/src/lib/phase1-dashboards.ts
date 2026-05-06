import type { RoleSlug } from "@/lib/role-blueprints";

export interface PhaseDashboardSection {
  id: string;
  title: string;
  summary: string;
  highlights: string[];
}

export interface PhaseDashboard {
  northStar: string;
  sections: PhaseDashboardSection[];
  governanceRail: string[];
}

export const phase1Dashboards: Record<RoleSlug, PhaseDashboard> = {
  admin: {
    northStar:
      "Drive institution-wide governance, data operations, and student lifecycle transitions from one control surface.",
    sections: [
      {
        id: "admin-governance",
        title: "Global Configuration and Governance",
        summary: "Set the academic operating context used by every role in the ERP.",
        highlights: [
          "Configure active semester mode with global start and end dates.",
          "Define institution thresholds like attendance and AICTE policy limits.",
          "Trigger semester progression workflows and alumni transition jobs.",
        ],
      },
      {
        id: "admin-data",
        title: "Data Infrastructure and Management",
        summary: "Maintain clean and scalable data foundations across the institution.",
        highlights: [
          "Run bulk CSV ingestion for students, faculty, subjects, and timetable data.",
          "Enforce institutional identity protocols for UID and email standards.",
          "Oversee object storage readiness for notices and study material distribution.",
        ],
      },
      {
        id: "admin-advanced",
        title: "Advanced Administrative Modules",
        summary: "Operate automated planning and decision-support workflows.",
        highlights: [
          "Generate exam seating matrices from capacity and scheduling constraints.",
          "Automate invigilation matrix assignments for fair supervision load balancing.",
          "Use AI-assisted notice generation for institutional communications.",
        ],
      },
      {
        id: "admin-lifecycle",
        title: "Alumni and Lifecycle Automation",
        summary: "Manage graduation transitions and long-term archive governance.",
        highlights: [
          "Move final-semester students into alumni records automatically.",
          "Publish institutional reporting for CGPA, placement, and completion trends.",
          "Revoke active access and preserve transcript-only visibility for alumni users.",
        ],
      },
    ],
    governanceRail: [
      "Every role follows the active semester policy configured by Admin.",
      "Identity standards are mandatory for all ingestion and login flows.",
      "Alumni transition blocks unresolved backlog cases from final archival status.",
      "Institution notices and evidence files are retained through managed object storage.",
    ],
  },
  hod: {
    northStar:
      "Lead branch-level academic performance and faculty deployment while resolving escalations with policy-aligned decisions.",
    sections: [
      {
        id: "hod-analytics",
        title: "Departmental Analytics and Oversight",
        summary: "Monitor branch health with outcomes, attendance, and risk visibility.",
        highlights: [
          "Track branch-wide marks distribution, attendance, and exam outcomes.",
          "Review student-level KT and SUPPLI status movement across semesters.",
          "Inspect optional AI syllabus pacing trends from faculty lecture logs.",
        ],
      },
      {
        id: "hod-faculty",
        title: "Faculty Management and Coordination",
        summary: "Deploy staff capacity across subjects, roles, and branch communications.",
        highlights: [
          "Assign subject ownership and class mapping for active semester load.",
          "Designate Class Incharge, Subject Incharge, and Teacher Guardian roles.",
          "Broadcast branch notices and review faculty material distribution quality.",
        ],
      },
      {
        id: "hod-triage",
        title: "Triage and Administrative Action",
        summary: "Resolve unresolved cases and maintain continuity during disruptions.",
        highlights: [
          "Handle escalated academic grievances that exceed Subject Incharge scope.",
          "Run leave substitution workflows for planned and emergency cases.",
          "Generate AI-assisted intervention notices for branch-specific issues.",
        ],
      },
      {
        id: "hod-context",
        title: "Operational Context",
        summary: "Operate as the bridge between institutional policy and faculty execution.",
        highlights: [
          "Access rights stay restricted to the assigned branch and semester.",
          "Faculty can hold HOD plus teaching designations at the same time.",
          "All branch actions inherit Admin-defined semester boundaries.",
        ],
      },
    ],
    governanceRail: [
      "Branch scope is strict and cannot cross departmental boundaries.",
      "Escalation handling follows academic-first routing policies.",
      "Role assignments are semester-scoped and auditable.",
      "Global semester settings from Admin remain authoritative.",
    ],
  },
  "class-incharge": {
    northStar:
      "Protect class-level academic progression by combining analytics, PTM readiness, and intervention workflows.",
    sections: [
      {
        id: "ci-oversight",
        title: "Academic Oversight and Analytics",
        summary: "Identify risk early and maintain visibility for all students in the division.",
        highlights: [
          "Monitor class-wide marks, attendance, and subject progression trends.",
          "Flag at-risk students using attendance, GPA drift, and grievance signals.",
          "Track AICTE points and unresolved backlog indicators per student.",
        ],
      },
      {
        id: "ci-communication",
        title: "Communication and Coordination",
        summary: "Coordinate parents, TGs, and class communications around student outcomes.",
        highlights: [
          "Generate PTM-ready student portfolios with academic and grievance context.",
          "Maintain parent and TG coordination for proactive interventions.",
          "Broadcast tiered class notices and opportunity updates.",
        ],
      },
      {
        id: "ci-triage",
        title: "Triage and Lifecycle Management",
        summary: "Resolve interpersonal issues and keep progression milestones on track.",
        highlights: [
          "Act on AI-routed interpersonal conflict cases for assigned students.",
          "Trigger attendance intervention flows for below-threshold cohorts.",
          "Review promotion readiness before year transition and alumni movement.",
        ],
      },
      {
        id: "ci-context",
        title: "Operational Context",
        summary: "Work inside strict division scope while supporting multi-role faculty workloads.",
        highlights: [
          "HOD assigns role scope and duration per active semester.",
          "Faculty can combine Class Incharge with Subject Incharge and TG responsibilities.",
          "Student identity and tracking follow institutional UID and email standards.",
        ],
      },
    ],
    governanceRail: [
      "Division-level access is isolated and role-bound.",
      "At-risk interventions are evidence-led and traceable.",
      "PTM documentation must use latest student data snapshots.",
      "Progression checks must include backlog and attendance risk signals.",
    ],
  },
  "subject-incharge": {
    northStar:
      "Run subject execution with precision through marks control, attendance discipline, lecture traceability, and pacing intelligence.",
    sections: [
      {
        id: "si-assessment",
        title: "Academic Management and Assessment",
        summary: "Control subject-level scoring accuracy with granular performance visibility.",
        highlights: [
          "Maintain internal and supplementary marks with immediate dashboard updates.",
          "Review subject score distributions and topic-wise weak zones.",
          "Use performance heat patterns to tune remedial teaching plans.",
        ],
      },
      {
        id: "si-operations",
        title: "Classroom Operations and AI Integration",
        summary: "Reduce classroom friction while enforcing attendance and syllabus discipline.",
        highlights: [
          "Mark attendance from active slot context with fast default-present toggles.",
          "Auto-flag below-threshold attendance cases for escalation workflows.",
          "Run AI pacing checks against syllabus coverage and lecture execution data.",
        ],
      },
      {
        id: "si-triage",
        title: "Execution and Triage",
        summary: "Keep curriculum execution auditable while resolving academic conflicts.",
        highlights: [
          "Log every lecture with taught syllabus and additional topics.",
          "Resolve marks-related grievances as first-level academic authority.",
          "Feed TG improvement reports with updated subject performance context.",
        ],
      },
      {
        id: "si-context",
        title: "Operational Context",
        summary: "Operate in role-restricted subject scope within semester policy boundaries.",
        highlights: [
          "Assignment rights apply only to HOD-mapped subjects and classes.",
          "Faculty may hold Subject Incharge with Class Incharge and TG designations.",
          "All execution windows inherit Admin semester configuration.",
        ],
      },
    ],
    governanceRail: [
      "Lecture logs are mandatory for syllabus traceability.",
      "Attendance and marks updates must remain subject-scoped.",
      "Grievance handling follows first-level academic ownership.",
      "AI pacing insights support decisions but do not override faculty records.",
    ],
  },
  "practical-teacher": {
    northStar:
      "Deliver reliable lab execution with session ownership, experiment-level evidence, and strict audit integrity.",
    sections: [
      {
        id: "pt-execution",
        title: "Lab Execution and Practical Operations",
        summary: "Coordinate structured practical delivery per session and batch.",
        highlights: [
          "Run lab sessions by timetable alignment or manual assignment.",
          "Handle experiments across batch groups with consistent session flow.",
          "Keep each session owned by a single assigned faculty for accountability.",
        ],
      },
      {
        id: "pt-evaluation",
        title: "Practical Evaluation and Marking",
        summary: "Capture experiment-level quality signals instead of only aggregate marks.",
        highlights: [
          "Score viva, execution, and journal components for each student.",
          "Store experiment-level remarks and session-tied performance traces.",
          "Preserve granular records for faculty and HOD review.",
        ],
      },
      {
        id: "pt-attendance",
        title: "Attendance and Submission Tracking",
        summary: "Track participation and file compliance with batch-level visibility.",
        highlights: [
          "Record one attendance entry per student per session.",
          "Track submission state as Submitted, Late, or Missing.",
          "Detect repeated absences and participation anomalies early.",
        ],
      },
      {
        id: "pt-integrity",
        title: "Access Control and Session Integrity",
        summary: "Enforce assignment-based controls and immutable closure behavior.",
        highlights: [
          "Only assigned faculty can mark attendance, marks, and remarks.",
          "Lock completed sessions to prevent post-close edits.",
          "Retain faculty and timestamp audit trail for every update.",
        ],
      },
      {
        id: "pt-integration",
        title: "Integration and Operating Context",
        summary: "Keep practical systems connected with timetable, dashboards, and branch governance.",
        highlights: [
          "Support substitution hierarchy from Lab Instructor to TG as fallback.",
          "Push practical outcomes directly to student dashboard views.",
          "Operate independently from theory workflows but within semester policy.",
        ],
      },
    ],
    governanceRail: [
      "Session ownership is assignment-driven, not permanently role-bound.",
      "Locked sessions are immutable and audit-safe.",
      "Access scope is limited to assigned subjects and batches.",
      "Practical records sync downstream to student and HOD views.",
    ],
  },
  "teacher-guardian": {
    northStar:
      "Mentor a focused cohort with performance guidance, grievance care, and parent-facing improvement communication.",
    sections: [
      {
        id: "tg-mentorship",
        title: "Mentorship and Student Performance",
        summary: "Guide assigned mentees through academic and co-curricular growth.",
        highlights: [
          "Track marks, attendance, and unresolved backlog indicators for each mentee.",
          "Award AICTE points for verified co-curricular achievements.",
          "Generate AI-assisted improvement reports for personalized guidance.",
        ],
      },
      {
        id: "tg-communication",
        title: "Communication and Grievance Resolution",
        summary: "Coordinate with students and parents on behavior, support, and outcomes.",
        highlights: [
          "Handle interpersonal grievance tickets routed by AI triage.",
          "Lead PTM conversations with evidence-based student portfolios.",
          "Ensure mentees receive critical institutional notices and opportunities.",
        ],
      },
      {
        id: "tg-integration",
        title: "Operational Context and Integration",
        summary: "Work inside the wider ERP mentoring fabric with synchronized outcomes.",
        highlights: [
          "Operate with multi-designation compatibility across teaching roles.",
          "Publish points and mentoring outcomes instantly to student dashboards.",
          "Collaborate with Class Incharge for progression readiness actions.",
        ],
      },
      {
        id: "tg-scope",
        title: "Administrative Scope",
        summary: "Maintain privacy-safe, assignment-bound access boundaries.",
        highlights: [
          "Mentee allocation is assigned by HOD for each semester cycle.",
          "Access is restricted to assigned mentorship cohort records.",
          "Data visibility follows institutional privacy and role constraints.",
        ],
      },
    ],
    governanceRail: [
      "TG access remains limited to assigned mentees.",
      "Interpersonal grievance routing honors AI and policy mapping.",
      "AICTE points require evidence-backed activity records.",
      "Mentoring outcomes must stay synchronized with student dashboards.",
    ],
  },
  student: {
    northStar:
      "Give every student a real-time self-service cockpit for academics, grievance workflows, and lifecycle progression clarity.",
    sections: [
      {
        id: "st-dashboard",
        title: "Academic Dashboard and Management",
        summary: "Track daily academic status from one unified student view.",
        highlights: [
          "View marks, attendance, fee status, and AICTE points in one dashboard.",
          "Inspect active semester subjects and carry-forward records.",
          "See KT and SUPPLI status badges until each backlog is cleared.",
        ],
      },
      {
        id: "st-resources",
        title: "Communication and Campus Resources",
        summary: "Access routed support and academic resources without friction.",
        highlights: [
          "Submit structured grievances with evidence for AI routing.",
          "Receive AI-tagged notices such as urgent updates and opportunities.",
          "Download study materials delivered through secure object storage.",
        ],
      },
      {
        id: "st-lifecycle",
        title: "Lifecycle and Progression",
        summary: "Follow transparent year and graduation transitions.",
        highlights: [
          "Auto-update academic year labels based on completed semesters.",
          "Block alumni transition while unresolved backlog subjects exist.",
          "Move to transcript-only alumni mode after successful completion.",
        ],
      },
      {
        id: "st-identity",
        title: "Identity Standards",
        summary: "Maintain reliable institutional identity across all student operations.",
        highlights: [
          "Use institutional email as the primary login identity.",
          "Use standardized UID format for every student record.",
          "Keep timetable and faculty locator aligned with system clock context.",
        ],
      },
    ],
    governanceRail: [
      "Student identity is email plus UID governed by institutional standards.",
      "Backlog status directly affects progression and alumni eligibility.",
      "Grievances follow AI-assisted authority routing rules.",
      "All student actions remain within active semester boundaries.",
    ],
  },
};
