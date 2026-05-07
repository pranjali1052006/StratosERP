USE StratosERP;

-- Remove legacy student seed data.
DELETE FROM tg_assignment
WHERE student_uid = '2021-CE-A-01-2025';

DELETE FROM student_subject_record
WHERE student_uid = '2021-CE-A-01-2025';

DELETE FROM student
WHERE uid = '2021-CE-A-01-2025'
  OR email_id = 'student@stratoserp.edu'
  OR email_id = 'student@tcetmumbai.in';

-- Ensure only one seeded login account is maintained: admin@tcetmumbai.in
-- Seed password: 159753
UPDATE faculty
SET designation_role = 'Subject Incharge',
    is_admin = 1,
    is_hod = 0,
    password_hash = '$2a$12$MH8yz58CwaYYWPklBq5g4OVfMkpP.jD6XIbZxFnFefj5k.4c6gq7K'
WHERE email_id = 'admin@tcetmumbai.in';

UPDATE faculty
SET email_id = 'admin@tcetmumbai.in',
    designation_role = 'Subject Incharge',
    is_admin = 1,
    is_hod = 0,
    password_hash = '$2a$12$MH8yz58CwaYYWPklBq5g4OVfMkpP.jD6XIbZxFnFefj5k.4c6gq7K'
WHERE email_id = 'admin@stratoserp.edu'
  AND NOT EXISTS (
    SELECT 1
    FROM faculty
    WHERE email_id = 'admin@tcetmumbai.in'
  );

INSERT INTO faculty (name, email_id, designation_role, is_admin, is_hod, password_hash)
SELECT 'Admin User', 'admin@tcetmumbai.in', 'Subject Incharge', 1, 0,
       '$2a$12$MH8yz58CwaYYWPklBq5g4OVfMkpP.jD6XIbZxFnFefj5k.4c6gq7K'
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1
  FROM faculty
  WHERE email_id = 'admin@tcetmumbai.in'
);

-- Global config (active_semester_type must be 'ODD' or 'EVEN')
INSERT INTO global_config (active_semester_type, start_date, end_date)
VALUES ('ODD', '2024-07-01', '2024-11-30');

-- Test subject
INSERT INTO subject (name, semester_level, has_lab, lab_marks_weight)
VALUES ('Data Structures', 3, TRUE, 30)
ON DUPLICATE KEY UPDATE has_lab=TRUE;

SELECT 'Seed data applied successfully.' AS status;
