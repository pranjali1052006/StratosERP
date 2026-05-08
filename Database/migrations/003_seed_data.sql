USE StratosERP;

-- Seed password for all accounts listed below: 159753
-- Bcrypt hash for 159753 is reused for all seeded users.
SET @seed_password_hash := '$2a$12$MH8yz58CwaYYWPklBq5g4OVfMkpP.jD6XIbZxFnFefj5k.4c6gq7K';
SET @seed_student_uid := '2021-CE-A-01-2025';

-- Ensure auth columns exist for environments where migration 002 was skipped.
DROP PROCEDURE IF EXISTS sp_seed_auth_columns;
DELIMITER $$
CREATE PROCEDURE sp_seed_auth_columns()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'faculty' AND COLUMN_NAME = 'password_hash'
  ) THEN
    ALTER TABLE faculty ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'faculty' AND COLUMN_NAME = 'is_hod'
  ) THEN
    ALTER TABLE faculty ADD COLUMN is_hod BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student' AND COLUMN_NAME = 'password_hash'
  ) THEN
    ALTER TABLE student ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT '';
  END IF;
END$$
DELIMITER ;
CALL sp_seed_auth_columns();
DROP PROCEDURE IF EXISTS sp_seed_auth_columns;

-- Admin account
CREATE TABLE IF NOT EXISTS admin_user (
  admin_id      INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email_id      VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL
);

UPDATE admin_user
SET name = 'Admin User',
    email_id = 'admin@tcetmumbai.in',
    password_hash = @seed_password_hash
WHERE email_id IN ('admin@tcetmumbai.in', 'admin@stratoserp.edu');

INSERT INTO admin_user (name, email_id, password_hash)
SELECT 'Admin User', 'admin@tcetmumbai.in', @seed_password_hash
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1
  FROM admin_user
  WHERE email_id = 'admin@tcetmumbai.in'
);

-- Faculty seeds
-- 1) hod@tcetmumbai.in       -> HOD (is_hod=TRUE)
-- 2) subject@tcetmumbai.in   -> Subject Incharge
-- 3) class@tcetmumbai.in     -> Class Incharge
-- 4) guardian@tcetmumbai.in  -> TG
INSERT INTO faculty (name, email_id, designation_role, password_hash, is_hod)
VALUES
  ('HOD User', 'hod@tcetmumbai.in', 'Subject Incharge', @seed_password_hash, TRUE),
  ('Subject Incharge User', 'subject@tcetmumbai.in', 'Subject Incharge', @seed_password_hash, FALSE),
  ('Class Incharge User', 'class@tcetmumbai.in', 'Class Incharge', @seed_password_hash, FALSE),
  ('Teacher Guardian User', 'guardian@tcetmumbai.in', 'TG', @seed_password_hash, FALSE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  designation_role = VALUES(designation_role),
  password_hash = VALUES(password_hash),
  is_hod = VALUES(is_hod);

-- Student seed
-- 5) student@tcetmumbai.in -> Student
INSERT INTO student (uid, email_id, current_semester, academic_year, password_hash)
VALUES (@seed_student_uid, 'student@tcetmumbai.in', 3, '2nd', @seed_password_hash)
ON DUPLICATE KEY UPDATE
  email_id = VALUES(email_id),
  current_semester = VALUES(current_semester),
  academic_year = VALUES(academic_year),
  password_hash = VALUES(password_hash);

-- Ensure one active global config row exists and is usable.
UPDATE global_config
SET active_semester_type = 'ODD',
    start_date = '2024-07-01',
    end_date = '2024-11-30'
ORDER BY config_id
LIMIT 1;

INSERT INTO global_config (active_semester_type, start_date, end_date)
SELECT 'ODD', '2024-07-01', '2024-11-30'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM global_config);

-- Dashboard-ready academic data for all seeded roles.
INSERT INTO subject (name, semester_level, has_lab, lab_marks_weight)
SELECT 'Data Structures', 3, TRUE, 30
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM subject WHERE name = 'Data Structures' AND semester_level = 3
);

SET @subject_id := (
  SELECT subject_id
  FROM subject
  WHERE name = 'Data Structures' AND semester_level = 3
  ORDER BY subject_id
  LIMIT 1
);

SET @hod_faculty_id := (
  SELECT faculty_id FROM faculty WHERE email_id = 'hod@tcetmumbai.in' LIMIT 1
);
SET @subject_faculty_id := (
  SELECT faculty_id FROM faculty WHERE email_id = 'subject@tcetmumbai.in' LIMIT 1
);
SET @class_faculty_id := (
  SELECT faculty_id FROM faculty WHERE email_id = 'class@tcetmumbai.in' LIMIT 1
);
SET @guardian_faculty_id := (
  SELECT faculty_id FROM faculty WHERE email_id = 'guardian@tcetmumbai.in' LIMIT 1
);

INSERT INTO timetable_slot (day_of_week, start_time, end_time, subject_id, faculty_id)
SELECT 'Monday', '10:00:00', '11:00:00', @subject_id, @subject_faculty_id
FROM DUAL
WHERE @subject_id IS NOT NULL
  AND @subject_faculty_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM timetable_slot
    WHERE day_of_week = 'Monday'
      AND start_time = '10:00:00'
      AND end_time = '11:00:00'
      AND subject_id = @subject_id
      AND faculty_id = @subject_faculty_id
  );

INSERT INTO timetable_slot (day_of_week, start_time, end_time, subject_id, faculty_id)
SELECT 'Tuesday', '11:00:00', '12:00:00', @subject_id, @hod_faculty_id
FROM DUAL
WHERE @subject_id IS NOT NULL
  AND @hod_faculty_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM timetable_slot
    WHERE day_of_week = 'Tuesday'
      AND start_time = '11:00:00'
      AND end_time = '12:00:00'
      AND subject_id = @subject_id
      AND faculty_id = @hod_faculty_id
  );

INSERT INTO student_subject_record (student_uid, subject_id, status, marks)
SELECT @seed_student_uid, @subject_id, 'Active', 78
FROM DUAL
WHERE @subject_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  status = VALUES(status),
  marks = VALUES(marks);

INSERT INTO tg_assignment (faculty_id, student_uid, semester)
SELECT @guardian_faculty_id, @seed_student_uid, 3
FROM DUAL
WHERE @guardian_faculty_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  semester = VALUES(semester);

INSERT INTO aicte_points (student_uid, activity, points, awarded_by, awarded_at)
SELECT @seed_student_uid, 'Workshop Participation', 10, @guardian_faculty_id, NOW()
FROM DUAL
WHERE @guardian_faculty_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM aicte_points
    WHERE student_uid = @seed_student_uid
      AND activity = 'Workshop Participation'
      AND awarded_by = @guardian_faculty_id
  );

INSERT INTO grievance_ticket (student_uid, category, description, evidence, status, assigned_authority_id)
SELECT @seed_student_uid,
       'Academic Support',
       'Need guidance for improving Data Structures performance.',
       NULL,
       'Open',
       @guardian_faculty_id
FROM DUAL
WHERE @guardian_faculty_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM grievance_ticket
    WHERE student_uid = @seed_student_uid
      AND category = 'Academic Support'
      AND status = 'Open'
  );

INSERT INTO notice_board (title, target_audience, ai_filter_tags)
SELECT 'Welcome: Phase-I demo dashboards are seeded.', 'INSTITUTE', JSON_ARRAY('seed', 'onboarding')
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM notice_board WHERE title = 'Welcome: Phase-I demo dashboards are seeded.'
);

INSERT INTO notice_board (title, target_audience, ai_filter_tags)
SELECT 'Data Structures: Unit-1 review session on Friday.', 'BRANCH', JSON_ARRAY('academics', 'revision')
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM notice_board WHERE title = 'Data Structures: Unit-1 review session on Friday.'
);

SELECT 'Seed data applied successfully.' AS status;
