# StratosERP — Database Engineering Progress Log

**Engineer:** Rishit Singh  
**Last Updated:** 2026-05-03  
**Engine:** MySQL 8.0+ · Charset: `utf8mb4` / `utf8mb4_unicode_ci`  
**Schema File:** `Database/schema.sql`

---

## Phase 1 — Core Schema (Completed)

### Objective
Design and implement the foundational relational database for StratosERP covering students, faculty, subjects, timetable management, grievances, leave, and notices.

### Tables Created

| # | Table | Purpose |
|---|-------|---------|
| 1 | `subject` | Subject catalogue with semester-level tagging |
| 2 | `global_config` | Singleton-style active semester configuration (ODD/EVEN) |
| 3 | `faculty` | Faculty profiles with role classification |
| 4 | `student` | Student profiles with UID format and academic year tracking |
| 5 | `student_subject_record` | Junction: student ↔ subject enrolment + status + marks |
| 6 | `timetable_slot` | Recurring weekly theory timetable slots |
| 7 | `lecture_log` | Auto-generated log when a timetable slot's class is conducted |
| 8 | `grievance_ticket` | Student grievances with AI-routed authority assignment |
| 9 | `leave_substitution` | Faculty leave + substitute assignment tracking |
| 10 | `notice_board` | Institute/branch notices with AI-generated filter tags |

### Key Design Decisions

- **`SERIAL` → `INT AUTO_INCREMENT`**: MySQL does not have a native `SERIAL` type; `INT AUTO_INCREMENT PRIMARY KEY` is the direct equivalent.
- **`NUMERIC` → `DECIMAL`**: `DECIMAL(5,2)` is used for marks fields for explicit precision control.
- **`TIMESTAMPTZ` → `TIMESTAMP`**: MySQL `TIMESTAMP` stores values in UTC internally.
- **`notice_board.ai_filter_tags`**: Changed from `TEXT` (comma-separated) to `JSON` column to enable native `JSON_CONTAINS()` / `JSON_OVERLAPS()` queries.
- **Partial unique index on `global_config`**: Not supported in MySQL. Enforced at the application layer (Business Rule #2).

### Constraints Summary

- All `CHECK` constraints use named `CONSTRAINT` identifiers for easier debugging.
- `student.uid` format (`^\d{4}-[A-Z]{2,3}-[A-Z]-\d{2}-\d{4}$`) is enforced at the application layer.
- `leave_substitution` prevents self-substitution via `CHECK (absent_faculty_id <> substitute_faculty_id)`.
- `lecture_log` has a composite `UNIQUE KEY (slot_id, execution_date)` — one log per slot per day.

### Indexes (Phase 1)

```sql
idx_ssr_student, idx_ssr_subject         -- student_subject_record
idx_slot_faculty, idx_slot_subject       -- timetable_slot
idx_log_slot, idx_log_date               -- lecture_log
idx_grievance_student, idx_grievance_status  -- grievance_ticket
idx_leave_absent, idx_leave_date         -- leave_substitution
```

### Views

| View | Joins |
|------|-------|
| `active_timetable` | `timetable_slot` + `subject` + `faculty` |
| `student_dashboard` | `student` + `student_subject_record` + `subject` |

### Trigger

- **`trg_grievance_updated_at`** — `BEFORE UPDATE` trigger on `grievance_ticket` to stamp `updated_at = NOW()`. The `ON UPDATE CURRENT_TIMESTAMP` column attribute also handles this natively; the trigger provides explicit parity with the specification.

### Seed Data

```sql
INSERT INTO global_config (active_semester_type, start_date, end_date)
VALUES ('ODD', '2026-07-01', '2026-11-30');
```

### Business Rules (Application Layer)

1. Student UID must match regex: `^\d{4}-[A-Z]{2,3}-[A-Z]-\d{2}-\d{4}$`
2. Only ONE row should be active in `global_config` at a time.
3. `grievance_ticket.assigned_authority_id` is populated asynchronously by Gemini AI after ticket creation.
4. `lecture_log` rows are auto-created when a timetable slot's class is marked as conducted.
5. `leave_substitution.substitute_faculty_id` must not already have a `timetable_slot` on that `leave_date` (check before insert).
6. `student_subject_record.status = 'KT'` or `'SUPPLI'` means the student carries the subject forward.
7. `notice_board.ai_filter_tags` stored as a JSON array for flexible querying.

---

## Phase 2 — Lab / Practical Management System Extension (Completed)

### Objective
Extend the existing schema with a complete lab management subsystem supporting batch-wise lab execution, experiment-level marking, lab attendance, and digital submission tracking — without modifying or breaking any Phase 1 tables.

### Approach
- **Non-breaking extension**: All changes are additive (`ALTER TABLE` with new columns only, new tables only).
- **`timetable_slot`, `lecture_log`, `student_subject_record`** are deliberately untouched; theory and lab systems remain independent.
- Lab sessions are assignment-based (not role-based), controlled through `lab_session`.

### Schema Changes

#### ALTER: `subject` table
Two columns added to flag lab subjects:

```sql
ALTER TABLE subject
  ADD COLUMN has_lab          BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN lab_marks_weight INT     NULL,
  ADD CONSTRAINT chk_lab_marks_weight CHECK (lab_marks_weight <= 100);
```

| Column | Type | Purpose |
|--------|------|---------|
| `has_lab` | `BOOLEAN DEFAULT FALSE` | Flags whether the subject has a lab component |
| `lab_marks_weight` | `INT NULL` | Percentage weight of lab marks in final grade (0–100) |

#### New Tables

| # | Table | Purpose |
|---|-------|---------|
| 11 | `lab_batch` | Groups students into named batches per subject with an assigned faculty |
| 12 | `experiment` | Catalogue of experiments per subject with max marks |
| 13 | `lab_session` | Core control unit — one session per batch per date |
| 14 | `lab_attendance` | Per-student attendance per lab session |
| 15 | `lab_marks` | Experiment-level marks (viva + execution + journal + total) |
| 16 | `lab_submission` | Optional digital file submission tracking per experiment |

### Entity Relationship Summary (Lab System)

```
subject ──< lab_batch >── faculty
subject ──< experiment
lab_batch ──< lab_session >── faculty (assigned)
lab_session ──< lab_attendance >── student
lab_session ──< lab_marks >── experiment >── student
experiment ──< lab_submission >── student
```

### Table Details

#### `lab_batch` (Table 11)
- Unique per `(subject_id, batch_name)` — prevents duplicate batch names within a subject.
- `faculty_id` is the default lab instructor for the batch.

#### `experiment` (Table 12)
- `experiment_no` is unique within a subject (e.g., Experiment 1, 2, 3…).
- `max_marks` defines the ceiling for marking validation at application layer.

#### `lab_session` (Table 13)
- **Status lifecycle**: `Pending` → `Completed` → `Locked`
- `is_substitute = TRUE` activates `original_faculty_id` to record who was originally assigned.
- `assigned_faculty_id` always holds the actual conducting faculty.

#### `lab_attendance` (Table 14)
- Composite `UNIQUE KEY (session_id, student_uid)` prevents duplicate attendance entries.
- `ON DELETE CASCADE` from both `lab_session` and `student` maintains referential integrity automatically.

#### `lab_marks` (Table 15)
- Granularity: one row per `(student_uid, experiment_id)` — unique constraint enforced.
- `total_marks` is stored (denormalised) for query performance; application must keep it in sync with component marks.
- `updated_by` tracks the faculty who last saved marks.
- `ON UPDATE CURRENT_TIMESTAMP` on `updated_at` provides automatic audit stamping.

#### `lab_submission` (Table 16)
- Optional/scalable — not required for core lab operation.
- `file_url` stores a URL or relative file path to the uploaded file.
- `status` values: `Submitted`, `Late`, `Missing`.

### Indexes (Phase 2)

```sql
idx_lab_session_subject_date  ON lab_session(subject_id, session_date)
idx_lab_marks_student         ON lab_marks(student_uid)
idx_lab_attendance_session    ON lab_attendance(session_id)
```

### Business Rules (Application Layer — Lab System)

1. `lab_marks.total_marks` must be recalculated and saved by the application whenever component marks change.
2. A `lab_session` can only transition to `Locked` after `status = 'Completed'`; locked sessions must not allow mark edits.
3. Substitute logic for lab sessions mirrors `leave_substitution` — check `lab_session` conflicts before assigning substitute faculty.
4. `lab_marks_weight` on `subject` must be set if `has_lab = TRUE`; validated at application layer.
5. `experiment.max_marks` should be used by the application to validate that component marks do not exceed the cap.

---

## Full Table Inventory

| # | Table | Phase | Category |
|---|-------|-------|----------|
| 1 | `subject` | 1 (extended in 2) | Core |
| 2 | `global_config` | 1 | Core |
| 3 | `faculty` | 1 | Core |
| 4 | `student` | 1 | Core |
| 5 | `student_subject_record` | 1 | Theory |
| 6 | `timetable_slot` | 1 | Theory |
| 7 | `lecture_log` | 1 | Theory |
| 8 | `grievance_ticket` | 1 | Admin |
| 9 | `leave_substitution` | 1 | Admin |
| 10 | `notice_board` | 1 | Admin |
| 11 | `lab_batch` | 2 | Lab |
| 12 | `experiment` | 2 | Lab |
| 13 | `lab_session` | 2 | Lab |
| 14 | `lab_attendance` | 2 | Lab |
| 15 | `lab_marks` | 2 | Lab |
| 16 | `lab_submission` | 2 | Lab |

---
