import pool from '../config/database';

// ── Dashboard ─────────────────────────────────────────────────

export async function getStudentDashboard(uid: string) {
  const [[student]] = await pool.query<any[]>(`
    SELECT uid, email_id, current_semester, academic_year FROM student WHERE uid = ?
  `, [uid]);
  if (!student) return null;

  const [subjects] = await pool.query<any[]>(`
    SELECT sub.subject_id, sub.name, sub.semester_level, sub.has_lab, ssr.marks, ssr.status
    FROM student_subject_record ssr
    JOIN subject sub ON ssr.subject_id = sub.subject_id
    WHERE ssr.student_uid = ?
    ORDER BY sub.semester_level DESC, sub.name
  `, [uid]);

  const aicte = await getAICTETotal(uid);

  return { student, subjects, aicte_total_points: aicte };
}

export async function getAICTETotal(uid: string): Promise<number> {
  const [[{ total }]] = await pool.query<any[]>(
    'SELECT COALESCE(SUM(points), 0) AS total FROM aicte_points WHERE student_uid = ?',
    [uid]
  );
  return total;
}

// ── Timetable & Live Faculty Locator ──────────────────────────

export async function getTimetable(uid: string) {
  const [[student]] = await pool.query<any[]>('SELECT current_semester FROM student WHERE uid = ?', [uid]);
  if (!student) return null;

  const [rows] = await pool.query<any[]>(`
    SELECT ts.slot_id, ts.day_of_week, ts.start_time, ts.end_time,
           s.name AS subject_name, f.name AS faculty_name
    FROM timetable_slot ts
    JOIN subject s ON ts.subject_id = s.subject_id
    JOIN faculty f ON ts.faculty_id = f.faculty_id
    WHERE s.semester_level = ?
    ORDER BY FIELD(ts.day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'), ts.start_time
  `, [student.current_semester]);
  return rows;
}

export async function liveFacultyLocator() {
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const now = new Date();
  const today = days[now.getDay()];
  const currentTime = now.toTimeString().slice(0, 8);

  const [rows] = await pool.query<any[]>(`
    SELECT ts.slot_id, ts.start_time, ts.end_time, ts.day_of_week,
           s.name AS subject_name, f.faculty_id, f.name AS faculty_name
    FROM timetable_slot ts
    JOIN subject s ON ts.subject_id = s.subject_id
    JOIN faculty f ON ts.faculty_id = f.faculty_id
    WHERE ts.day_of_week = ?
      AND ts.start_time <= ?
      AND ts.end_time >= ?
  `, [today, currentTime, currentTime]);
  return rows;
}

// ── Grievance Portal ──────────────────────────────────────────

export async function submitGrievance(data: {
  student_uid: string; category: string; description: string; evidence?: string;
}) {
  const [result] = await pool.query<any>(`
    INSERT INTO grievance_ticket (student_uid, category, description, evidence, status)
    VALUES (?, ?, ?, ?, 'Open')
  `, [data.student_uid, data.category, data.description, data.evidence || null]);
  return result.insertId;
}

export async function getMyGrievances(uid: string) {
  const [rows] = await pool.query<any[]>(`
    SELECT gt.ticket_id, gt.category, gt.description, gt.status,
           gt.created_at, gt.updated_at, f.name AS assigned_to
    FROM grievance_ticket gt
    LEFT JOIN faculty f ON gt.assigned_authority_id = f.faculty_id
    WHERE gt.student_uid = ?
    ORDER BY gt.created_at DESC
  `, [uid]);
  return rows;
}

// ── Notice Board ──────────────────────────────────────────────

export async function getNotices() {
  const [rows] = await pool.query<any[]>(
    "SELECT * FROM notice_board ORDER BY created_at DESC LIMIT 20"
  );
  return rows;
}

// ── Study Materials ───────────────────────────────────────────

export async function getStudyMaterials(subjectId: number) {
  // Materials are stored in MinIO; we return object metadata from a materials_index
  // For simplicity, we query a virtual index or return MinIO listing
  return { subject_id: subjectId, note: 'Use /api/student/materials/:subject_id/download endpoint with object_name param.' };
}

// ── Lab Marks ─────────────────────────────────────────────────

export async function getLabMarks(uid: string) {
  const [rows] = await pool.query<any[]>(`
    SELECT lm.*, e.title AS experiment_title, s.name AS subject_name
    FROM lab_marks lm
    JOIN experiment e ON lm.experiment_id = e.experiment_id
    JOIN subject s ON lm.subject_id = s.subject_id
    WHERE lm.student_uid = ?
    ORDER BY s.name, e.experiment_no
  `, [uid]);
  return rows;
}
