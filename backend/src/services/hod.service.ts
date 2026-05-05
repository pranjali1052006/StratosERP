import pool from '../config/database';

// ── Faculty Management ────────────────────────────────────────

export async function assignSubjectToFaculty(subjectId: number, facultyId: number) {
  // Insert a timetable slot assignment (HOD level assignment)
  await pool.query(
    'UPDATE timetable_slot SET faculty_id = ? WHERE subject_id = ?',
    [facultyId, subjectId]
  );
}

export async function assignFacultyRole(facultyId: number, role: string) {
  const valid = ['Class Incharge', 'Subject Incharge', 'TG'];
  if (!valid.includes(role)) throw new Error('Invalid role designation.');
  await pool.query('UPDATE faculty SET designation_role = ? WHERE faculty_id = ?', [role, facultyId]);
}

export async function listFacultyByDepartment() {
  const [rows] = await pool.query<any[]>(
    'SELECT faculty_id, name, email_id, designation_role, is_hod FROM faculty WHERE is_admin = 0'
  );
  return rows;
}

// ── Branch Analytics ─────────────────────────────────────────

export async function getBranchAnalytics() {
  const [[studentStats]] = await pool.query<any[]>(`
    SELECT
      COUNT(DISTINCT s.uid)                    AS total_students,
      AVG(ssr.marks)                           AS avg_marks,
      SUM(CASE WHEN ssr.status = 'KT'     THEN 1 ELSE 0 END) AS total_kt,
      SUM(CASE WHEN ssr.status = 'SUPPLI' THEN 1 ELSE 0 END) AS total_suppli
    FROM student s
    LEFT JOIN student_subject_record ssr ON s.uid = ssr.student_uid
    WHERE s.academic_year != 'Alumni'
  `);

  const [semesterDist] = await pool.query<any[]>(`
    SELECT current_semester, COUNT(*) AS count
    FROM student
    WHERE academic_year != 'Alumni'
    GROUP BY current_semester
    ORDER BY current_semester
  `);

  return { summary: studentStats, semester_distribution: semesterDist };
}

export async function getStudentDashboard(uid: string) {
  const [rows] = await pool.query<any[]>('SELECT * FROM student_dashboard WHERE student_uid = ?', [uid]);
  return rows;
}

export async function getAlumniData() {
  const [rows] = await pool.query<any[]>(
    "SELECT uid, email_id, academic_year FROM student WHERE academic_year = 'Alumni' ORDER BY uid"
  );
  return rows;
}

// ── Grievance Escalation ──────────────────────────────────────

export async function getEscalatedGrievances() {
  const [rows] = await pool.query<any[]>(`
    SELECT gt.*, f.name AS assigned_to
    FROM grievance_ticket gt
    LEFT JOIN faculty f ON gt.assigned_authority_id = f.faculty_id
    WHERE gt.status = 'Escalated'
    ORDER BY gt.created_at DESC
  `);
  return rows;
}

export async function resolveGrievance(ticketId: number) {
  await pool.query("UPDATE grievance_ticket SET status = 'Resolved' WHERE ticket_id = ?", [ticketId]);
}

// ── Leave Management ─────────────────────────────────────────

export async function getLeaveSubstitutionLog() {
  const [rows] = await pool.query<any[]>(`
    SELECT ls.*, f1.name AS absent_faculty, f2.name AS substitute_faculty
    FROM leave_substitution ls
    JOIN faculty f1 ON ls.absent_faculty_id = f1.faculty_id
    JOIN faculty f2 ON ls.substitute_faculty_id = f2.faculty_id
    ORDER BY ls.leave_date DESC
  `);
  return rows;
}

export async function scheduleLeave(data: {
  absent_faculty_id: number; substitute_faculty_id: number; leave_date: string; type: string;
}) {
  // Business Rule: substitute must not have a timetable_slot on leave_date (app-layer check)
  const [conflicts] = await pool.query<any[]>(`
    SELECT ts.slot_id FROM timetable_slot ts
    WHERE ts.faculty_id = ?
      AND ? IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')
  `, [data.substitute_faculty_id, new Date(data.leave_date).toLocaleDateString('en-US', { weekday: 'long' })]);

  if (conflicts.length) {
    throw new Error('Substitute faculty has a timetable conflict on the specified date.');
  }

  const [result] = await pool.query<any>(
    'INSERT INTO leave_substitution (absent_faculty_id, substitute_faculty_id, leave_date, type) VALUES (?, ?, ?, ?)',
    [data.absent_faculty_id, data.substitute_faculty_id, data.leave_date, data.type]
  );
  return result.insertId;
}

// ── Notice Board ─────────────────────────────────────────────

export async function createBranchNotice(title: string, aiTags?: string[]) {
  const [result] = await pool.query<any>(
    'INSERT INTO notice_board (title, target_audience, ai_filter_tags) VALUES (?, ?, ?)',
    [title, 'BRANCH', JSON.stringify(aiTags || [])]
  );
  return result.insertId;
}

export async function getBranchNotices() {
  const [rows] = await pool.query<any[]>(
    "SELECT * FROM notice_board WHERE target_audience = 'BRANCH' ORDER BY created_at DESC"
  );
  return rows;
}

// ── Study Materials Oversight ─────────────────────────────────

export async function getSubjectsList() {
  const [rows] = await pool.query<any[]>(
    'SELECT subject_id, name, semester_level, has_lab FROM subject ORDER BY semester_level, name'
  );
  return rows;
}
