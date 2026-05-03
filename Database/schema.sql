-- =============================================================
-- DATABASE: StratosERP
-- Engine:   MySQL 8.0+
-- Charset:  utf8mb4 / utf8mb4_unicode_ci
-- =============================================================

CREATE DATABASE IF NOT EXISTS StratosERP
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE StratosERP;

-- =============================================================
-- TABLE 1: SUBJECT
-- =============================================================
CREATE TABLE subject (
  subject_id     INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  semester_level INT          NOT NULL,
  CONSTRAINT chk_subject_semester CHECK (semester_level BETWEEN 1 AND 8)
);

-- =============================================================
-- TABLE 2: GLOBAL_CONFIG
-- Singleton-style table. Only ONE active config row at a time.
-- NOTE: MySQL does not support partial/filtered unique indexes.
--       The "single active row" constraint is enforced at the
--       application layer (Business Rule #2).
-- =============================================================
CREATE TABLE global_config (
  config_id            INT AUTO_INCREMENT PRIMARY KEY,
  active_semester_type VARCHAR(4)  NOT NULL,
  start_date           DATE        NOT NULL,
  end_date             DATE        NOT NULL,
  CONSTRAINT chk_gc_semester_type CHECK (active_semester_type IN ('ODD', 'EVEN')),
  CONSTRAINT chk_gc_dates         CHECK (end_date > start_date)
);

-- =============================================================
-- TABLE 3: FACULTY
-- =============================================================
CREATE TABLE faculty (
  faculty_id       INT AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(100) NOT NULL,
  email_id         VARCHAR(150) NOT NULL UNIQUE,
  designation_role VARCHAR(30)  NOT NULL,
  CONSTRAINT chk_faculty_role CHECK (
    designation_role IN ('Class Incharge', 'Subject Incharge', 'TG')
  )
);

-- =============================================================
-- TABLE 4: STUDENT
-- UID Format: [StartYear]-[Class]-[Division]-[RollNo]-[EndYear]
-- Example:    2021-CE-A-01-2025
-- Format validated at application layer via regex:
--   ^\d{4}-[A-Z]{2,3}-[A-Z]-\d{2}-\d{4}$
-- =============================================================
CREATE TABLE student (
  uid              VARCHAR(30)  PRIMARY KEY,
  email_id         VARCHAR(150) NOT NULL UNIQUE,
  current_semester INT          NOT NULL,
  academic_year    VARCHAR(10)  NOT NULL,
  CONSTRAINT chk_student_semester     CHECK (current_semester BETWEEN 1 AND 8),
  CONSTRAINT chk_student_academic_yr  CHECK (
    academic_year IN ('1st', '2nd', '3rd', '4th', 'Alumni')
  )
);

-- =============================================================
-- TABLE 5: STUDENT_SUBJECT_RECORD
-- Junction table: student enrolment + academic status per subject.
-- =============================================================
CREATE TABLE student_subject_record (
  student_uid VARCHAR(30)   NOT NULL,
  subject_id  INT           NOT NULL,
  status      VARCHAR(10)   NOT NULL,
  marks       DECIMAL(5, 2) NULL,
  PRIMARY KEY (student_uid, subject_id),
  CONSTRAINT fk_ssr_student FOREIGN KEY (student_uid)
    REFERENCES student(uid)  ON DELETE CASCADE,
  CONSTRAINT fk_ssr_subject FOREIGN KEY (subject_id)
    REFERENCES subject(subject_id) ON DELETE CASCADE,
  CONSTRAINT chk_ssr_status CHECK (status IN ('Active', 'KT', 'SUPPLI', 'Cleared')),
  CONSTRAINT chk_ssr_marks  CHECK (marks >= 0 AND marks <= 100)
);

-- =============================================================
-- TABLE 6: TIMETABLE_SLOT
-- Links a subject + faculty to a recurring weekly time slot.
-- =============================================================
CREATE TABLE timetable_slot (
  slot_id     INT AUTO_INCREMENT PRIMARY KEY,
  day_of_week VARCHAR(10)  NOT NULL,
  start_time  TIME         NOT NULL,
  end_time    TIME         NOT NULL,
  subject_id  INT          NOT NULL,
  faculty_id  INT          NOT NULL,
  CONSTRAINT fk_slot_subject FOREIGN KEY (subject_id)
    REFERENCES subject(subject_id),
  CONSTRAINT fk_slot_faculty FOREIGN KEY (faculty_id)
    REFERENCES faculty(faculty_id),
  CONSTRAINT chk_slot_day CHECK (
    day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')
  ),
  CONSTRAINT chk_slot_times CHECK (end_time > start_time)
);

-- =============================================================
-- TABLE 7: LECTURE_LOG
-- Auto-generated when a timetable slot's class is conducted.
-- =============================================================
CREATE TABLE lecture_log (
  log_id                   INT AUTO_INCREMENT PRIMARY KEY,
  slot_id                  INT  NOT NULL,
  syllabus_topics_taught   TEXT,
  additional_topics_taught TEXT,
  execution_date           DATE NOT NULL,
  CONSTRAINT fk_log_slot     FOREIGN KEY (slot_id)
    REFERENCES timetable_slot(slot_id) ON DELETE CASCADE,
  UNIQUE KEY uq_log_slot_date (slot_id, execution_date)   -- One log per slot per day
);

-- =============================================================
-- TABLE 8: GRIEVANCE_TICKET
-- submitted by students; assigned_authority_id routed by Gemini AI.
-- updated_at is maintained automatically via ON UPDATE CURRENT_TIMESTAMP
-- AND via the trg_grievance_updated_at trigger (see below).
-- =============================================================
CREATE TABLE grievance_ticket (
  ticket_id             INT AUTO_INCREMENT PRIMARY KEY,
  student_uid           VARCHAR(30)  NOT NULL,
  category              VARCHAR(100) NOT NULL,
  description           TEXT         NOT NULL,
  evidence              TEXT,                         -- URL or file path to uploaded proof
  status                VARCHAR(15)  NOT NULL DEFAULT 'Open',
  assigned_authority_id INT,                          -- Populated asynchronously by Gemini AI
  created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                     ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_grievance_student   FOREIGN KEY (student_uid)
    REFERENCES student(uid) ON DELETE CASCADE,
  CONSTRAINT fk_grievance_authority FOREIGN KEY (assigned_authority_id)
    REFERENCES faculty(faculty_id),
  CONSTRAINT chk_grievance_status   CHECK (status IN ('Open', 'Resolved', 'Escalated'))
);

-- =============================================================
-- TABLE 9: LEAVE_SUBSTITUTION
-- Tracks faculty leave and substitute assignments.
-- Business Rule: substitute must not have a timetable_slot on leave_date
--               (enforced at application layer).
-- =============================================================
CREATE TABLE leave_substitution (
  leave_id              INT AUTO_INCREMENT PRIMARY KEY,
  absent_faculty_id     INT          NOT NULL,
  substitute_faculty_id INT          NOT NULL,
  leave_date            DATE         NOT NULL,
  type                  VARCHAR(15)  NOT NULL,
  CONSTRAINT fk_leave_absent     FOREIGN KEY (absent_faculty_id)
    REFERENCES faculty(faculty_id),
  CONSTRAINT fk_leave_substitute FOREIGN KEY (substitute_faculty_id)
    REFERENCES faculty(faculty_id),
  CONSTRAINT chk_leave_type      CHECK (type IN ('Planned', 'Emergency')),
  CONSTRAINT chk_leave_diff      CHECK (absent_faculty_id <> substitute_faculty_id)
);

-- =============================================================
-- TABLE 10: NOTICE_BOARD
-- ai_filter_tags stored as JSON array, e.g. ["exam","holiday"]
-- =============================================================
CREATE TABLE notice_board (
  notice_id       INT AUTO_INCREMENT PRIMARY KEY,
  title           VARCHAR(255) NOT NULL,
  target_audience VARCHAR(15)  NOT NULL,
  ai_filter_tags  JSON,                               -- JSON array for flexible querying
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_notice_audience CHECK (target_audience IN ('INSTITUTE', 'BRANCH'))
);


-- =============================================================
-- INDEXES
-- =============================================================
CREATE INDEX idx_ssr_student       ON student_subject_record(student_uid);
CREATE INDEX idx_ssr_subject       ON student_subject_record(subject_id);
CREATE INDEX idx_slot_faculty      ON timetable_slot(faculty_id);
CREATE INDEX idx_slot_subject      ON timetable_slot(subject_id);
CREATE INDEX idx_log_slot          ON lecture_log(slot_id);
CREATE INDEX idx_log_date          ON lecture_log(execution_date);
CREATE INDEX idx_grievance_student ON grievance_ticket(student_uid);
CREATE INDEX idx_grievance_status  ON grievance_ticket(status);
CREATE INDEX idx_leave_absent      ON leave_substitution(absent_faculty_id);
CREATE INDEX idx_leave_date        ON leave_substitution(leave_date);


-- =============================================================
-- TRIGGER: Auto-update grievance_ticket.updated_at
-- NOTE: The column's ON UPDATE CURRENT_TIMESTAMP attribute already
-- handles this automatically. This explicit BEFORE UPDATE trigger
-- is included for completeness and parity with the specification.
-- =============================================================
DELIMITER $$

CREATE TRIGGER trg_grievance_updated_at
BEFORE UPDATE ON grievance_ticket
FOR EACH ROW
BEGIN
  SET NEW.updated_at = NOW();
END$$

DELIMITER ;


-- =============================================================
-- VIEW: active_timetable
-- Joins timetable_slot + subject + faculty for schedule lookup.
-- =============================================================
CREATE OR REPLACE VIEW active_timetable AS
SELECT
  ts.slot_id,
  ts.day_of_week,
  ts.start_time,
  ts.end_time,
  s.subject_id,
  s.name           AS subject_name,
  s.semester_level,
  f.faculty_id,
  f.name           AS faculty_name,
  f.designation_role
FROM timetable_slot ts
INNER JOIN subject s ON ts.subject_id = s.subject_id
INNER JOIN faculty f ON ts.faculty_id = f.faculty_id;


-- =============================================================
-- VIEW: student_dashboard
-- Joins student + student_subject_record + subject.
-- =============================================================
CREATE OR REPLACE VIEW student_dashboard AS
SELECT
  st.uid           AS student_uid,
  st.email_id,
  st.current_semester,
  st.academic_year,
  ssr.subject_id,
  sub.name         AS subject_name,
  sub.semester_level,
  ssr.status,
  ssr.marks
FROM student st
INNER JOIN student_subject_record ssr ON st.uid        = ssr.student_uid
INNER JOIN subject                sub ON ssr.subject_id = sub.subject_id;


-- =============================================================
-- =============================================================
-- LAB / PRACTICAL MANAGEMENT SYSTEM EXTENSION
-- Added: 2026-05-03
-- Extends the StratosERP schema with batch-wise lab execution,
-- experiment-level marking, lab attendance, and submission
-- tracking. NO existing tables, constraints, or indexes are
-- modified except the controlled ALTER on `subject`.
-- =============================================================
-- =============================================================


-- =============================================================
-- STEP 1: Extend SUBJECT table
-- has_lab            : flags whether the subject has a lab component
-- lab_marks_weight   : percentage weight of lab marks (0–100, nullable)
-- =============================================================
ALTER TABLE subject
  ADD COLUMN has_lab          BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN lab_marks_weight INT     NULL,
  ADD CONSTRAINT chk_lab_marks_weight CHECK (lab_marks_weight <= 100);


-- =============================================================
-- TABLE 11: LAB_BATCH
-- Groups students into named batches per subject, each assigned
-- a faculty member as the primary lab instructor.
-- =============================================================
CREATE TABLE lab_batch (
  batch_id   INT          AUTO_INCREMENT PRIMARY KEY,
  subject_id INT          NOT NULL,
  batch_name VARCHAR(20)  NOT NULL,
  faculty_id INT          NOT NULL,
  CONSTRAINT fk_batch_subject FOREIGN KEY (subject_id)
    REFERENCES subject(subject_id) ON DELETE CASCADE,
  CONSTRAINT fk_batch_faculty FOREIGN KEY (faculty_id)
    REFERENCES faculty(faculty_id),
  UNIQUE KEY uq_subject_batch (subject_id, batch_name)
);


-- =============================================================
-- TABLE 12: EXPERIMENT
-- Catalogue of experiments defined per subject.
-- experiment_no is unique within a subject (e.g., Exp 1, Exp 2…).
-- =============================================================
CREATE TABLE experiment (
  experiment_id INT          AUTO_INCREMENT PRIMARY KEY,
  subject_id    INT          NOT NULL,
  experiment_no INT          NOT NULL,
  title         VARCHAR(255) NOT NULL,
  max_marks     INT          NOT NULL,
  CONSTRAINT fk_experiment_subject FOREIGN KEY (subject_id)
    REFERENCES subject(subject_id) ON DELETE CASCADE,
  UNIQUE KEY uq_experiment (subject_id, experiment_no)
);


-- =============================================================
-- TABLE 13: LAB_SESSION  (core control unit)
-- Represents one physical lab session for a batch on a date.
-- assigned_faculty_id  : who actually conducts it (may be substitute)
-- original_faculty_id  : set only when is_substitute = TRUE
-- status               : Pending → Completed → Locked
-- =============================================================
CREATE TABLE lab_session (
  session_id          INT          AUTO_INCREMENT PRIMARY KEY,
  subject_id          INT          NOT NULL,
  batch_id            INT          NOT NULL,
  session_date        DATE         NOT NULL,
  assigned_faculty_id INT          NOT NULL,
  original_faculty_id INT,
  is_substitute       BOOLEAN      NOT NULL DEFAULT FALSE,
  status              VARCHAR(15)  NOT NULL DEFAULT 'Pending',
  CONSTRAINT fk_session_subject FOREIGN KEY (subject_id)
    REFERENCES subject(subject_id),
  CONSTRAINT fk_session_batch   FOREIGN KEY (batch_id)
    REFERENCES lab_batch(batch_id),
  CONSTRAINT fk_session_faculty FOREIGN KEY (assigned_faculty_id)
    REFERENCES faculty(faculty_id),
  CONSTRAINT chk_session_status CHECK (status IN ('Pending', 'Completed', 'Locked'))
);


-- =============================================================
-- TABLE 14: LAB_ATTENDANCE
-- Records per-student attendance for each lab session.
-- Unique constraint prevents duplicate records per session+student.
-- =============================================================
CREATE TABLE lab_attendance (
  attendance_id INT         AUTO_INCREMENT PRIMARY KEY,
  session_id    INT         NOT NULL,
  student_uid   VARCHAR(30) NOT NULL,
  status        VARCHAR(10) NOT NULL,
  CONSTRAINT fk_lab_attendance_session FOREIGN KEY (session_id)
    REFERENCES lab_session(session_id) ON DELETE CASCADE,
  CONSTRAINT fk_lab_attendance_student FOREIGN KEY (student_uid)
    REFERENCES student(uid) ON DELETE CASCADE,
  CONSTRAINT chk_lab_attendance_status CHECK (status IN ('Present', 'Absent')),
  UNIQUE KEY uq_lab_attendance (session_id, student_uid)
);


-- =============================================================
-- TABLE 15: LAB_MARKS  (experiment-level granularity)
-- Stores viva / execution / journal marks per student per
-- experiment. total_marks is stored (denormalised) for query
-- performance; application layer must keep it consistent.
-- updated_by references the faculty who last saved marks.
-- =============================================================
CREATE TABLE lab_marks (
  mark_id         INT           AUTO_INCREMENT PRIMARY KEY,
  student_uid     VARCHAR(30)   NOT NULL,
  subject_id      INT           NOT NULL,
  experiment_id   INT           NOT NULL,
  session_id      INT           NOT NULL,
  viva_marks      DECIMAL(5, 2),
  execution_marks DECIMAL(5, 2),
  journal_marks   DECIMAL(5, 2),
  total_marks     DECIMAL(5, 2),
  remarks         TEXT,
  updated_by      INT,
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_lab_marks_student    FOREIGN KEY (student_uid)
    REFERENCES student(uid)      ON DELETE CASCADE,
  CONSTRAINT fk_lab_marks_subject    FOREIGN KEY (subject_id)
    REFERENCES subject(subject_id),
  CONSTRAINT fk_lab_marks_experiment FOREIGN KEY (experiment_id)
    REFERENCES experiment(experiment_id),
  CONSTRAINT fk_lab_marks_session    FOREIGN KEY (session_id)
    REFERENCES lab_session(session_id),
  CONSTRAINT fk_lab_marks_faculty    FOREIGN KEY (updated_by)
    REFERENCES faculty(faculty_id),
  UNIQUE KEY uq_lab_marks (student_uid, experiment_id)
);


-- =============================================================
-- TABLE 16: LAB_SUBMISSION  (optional, scalable)
-- Tracks digital file submissions per student per experiment.
-- file_url stores a URL or relative file path.
-- =============================================================
CREATE TABLE lab_submission (
  submission_id INT          AUTO_INCREMENT PRIMARY KEY,
  student_uid   VARCHAR(30)  NOT NULL,
  experiment_id INT          NOT NULL,
  file_url      TEXT,
  submitted_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status        VARCHAR(15),
  CONSTRAINT fk_submission_student    FOREIGN KEY (student_uid)
    REFERENCES student(uid),
  CONSTRAINT fk_submission_experiment FOREIGN KEY (experiment_id)
    REFERENCES experiment(experiment_id),
  CONSTRAINT chk_submission_status    CHECK (status IN ('Submitted', 'Late', 'Missing'))
);


-- =============================================================
-- LAB SYSTEM INDEXES
-- =============================================================
CREATE INDEX idx_lab_session_subject_date ON lab_session(subject_id, session_date);
CREATE INDEX idx_lab_marks_student        ON lab_marks(student_uid);
CREATE INDEX idx_lab_attendance_session   ON lab_attendance(session_id);