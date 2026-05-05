-- =============================================================
-- StratosERP Phase-I — Application Layer Extensions
-- Migration: 2026-05-05
-- Adds password_hash, is_admin, is_hod flags, aicte_points table,
-- and tg_assignment table required by the backend.
-- =============================================================

USE StratosERP;

-- Add password_hash and flag columns to faculty
ALTER TABLE faculty
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_admin       BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_hod         BOOLEAN     NOT NULL DEFAULT FALSE;

-- Add password_hash to student
ALTER TABLE student
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NOT NULL DEFAULT '';

-- =============================================================
-- TABLE: AICTE_POINTS
-- Tracks AICTE co-curricular/extra-curricular points per student
-- =============================================================
CREATE TABLE IF NOT EXISTS aicte_points (
  record_id   INT          AUTO_INCREMENT PRIMARY KEY,
  student_uid VARCHAR(30)  NOT NULL,
  activity    VARCHAR(255) NOT NULL,
  points      INT          NOT NULL,
  awarded_by  INT          NOT NULL,
  awarded_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_aicte_student FOREIGN KEY (student_uid)
    REFERENCES student(uid) ON DELETE CASCADE,
  CONSTRAINT fk_aicte_faculty FOREIGN KEY (awarded_by)
    REFERENCES faculty(faculty_id),
  CONSTRAINT chk_aicte_points CHECK (points > 0)
);

CREATE INDEX IF NOT EXISTS idx_aicte_student ON aicte_points(student_uid);

-- =============================================================
-- TABLE: TG_ASSIGNMENT
-- Links a Teacher Guardian (faculty) to their assigned students
-- =============================================================
CREATE TABLE IF NOT EXISTS tg_assignment (
  assignment_id INT         AUTO_INCREMENT PRIMARY KEY,
  faculty_id    INT         NOT NULL,
  student_uid   VARCHAR(30) NOT NULL,
  semester      INT         NOT NULL,
  CONSTRAINT fk_tga_faculty  FOREIGN KEY (faculty_id)
    REFERENCES faculty(faculty_id) ON DELETE CASCADE,
  CONSTRAINT fk_tga_student  FOREIGN KEY (student_uid)
    REFERENCES student(uid) ON DELETE CASCADE,
  UNIQUE KEY uq_tga (faculty_id, student_uid, semester)
);

CREATE INDEX IF NOT EXISTS idx_tga_faculty  ON tg_assignment(faculty_id);
CREATE INDEX IF NOT EXISTS idx_tga_student  ON tg_assignment(student_uid);
