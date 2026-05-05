import pool from '../config/database';

// ── Mentee Management ─────────────────────────────────────────

export async function getMentees(tgFacultyId: number) {
  // TG is assigned students via a tg_assignment table (conceptually);
  // In Phase-I we use a junction approach: tg_assignment stores tg_faculty_id + student_uid
  const [rows] = await pool.query<any[]>(`
    SELECT s.uid, s.email_id, s.current_semester, s.academic_year,
           COUNT(CASE WHEN ssr.status IN ('KT','SUPPLI') THEN 1 END) AS backlogs
    FROM tg_assignment ta
    JOIN student s ON ta.student_uid = s.uid
    LEFT JOIN student_subject_record ssr ON s.uid = ssr.student_uid
    WHERE ta.faculty_id = ?
    GROUP BY s.uid
    ORDER BY s.uid
  `, [tgFacultyId]);
  return rows;
}

export async function getMenteePortfolio(tgFacultyId: number, studentUid: string) {
  // Verify assignment
  const [[assignment]] = await pool.query<any[]>(
    'SELECT * FROM tg_assignment WHERE faculty_id = ? AND student_uid = ?',
    [tgFacultyId, studentUid]
  );
  if (!assignment) throw new Error('Student not in your mentee group.');

  const [[student]] = await pool.query<any[]>('SELECT * FROM student WHERE uid = ?', [studentUid]);

  const [subjects] = await pool.query<any[]>(`
    SELECT sub.name, sub.semester_level, ssr.marks, ssr.status
    FROM student_subject_record ssr
    JOIN subject sub ON ssr.subject_id = sub.subject_id
    WHERE ssr.student_uid = ?
  `, [studentUid]);

  const [aictePoints] = await pool.query<any[]>(
    'SELECT * FROM aicte_points WHERE student_uid = ? ORDER BY awarded_at DESC',
    [studentUid]
  );

  const [grievances] = await pool.query<any[]>(
    'SELECT * FROM grievance_ticket WHERE student_uid = ? ORDER BY created_at DESC',
    [studentUid]
  );

  return { student, subjects, aicte_points: aictePoints, grievances };
}

// ── AICTE Points ──────────────────────────────────────────────

export async function awardAICTEPoints(data: {
  student_uid: string; activity: string; points: number; faculty_id: number;
}) {
  const [result] = await pool.query<any>(`
    INSERT INTO aicte_points (student_uid, activity, points, awarded_by, awarded_at)
    VALUES (?, ?, ?, ?, NOW())
  `, [data.student_uid, data.activity, data.points, data.faculty_id]);
  return result.insertId;
}

export async function getAICTEPoints(studentUid: string) {
  const [rows] = await pool.query<any[]>(
    'SELECT * FROM aicte_points WHERE student_uid = ? ORDER BY awarded_at DESC',
    [studentUid]
  );
  const [[{ total }]] = await pool.query<any[]>(
    'SELECT COALESCE(SUM(points), 0) AS total FROM aicte_points WHERE student_uid = ?',
    [studentUid]
  );
  return { records: rows, total_points: total };
}

// ── Grievance Resolution ──────────────────────────────────────

export async function getAssignedGrievances(facultyId: number) {
  const [rows] = await pool.query<any[]>(`
    SELECT gt.*, s.email_id AS student_email
    FROM grievance_ticket gt
    JOIN student s ON gt.student_uid = s.uid
    WHERE gt.assigned_authority_id = ? AND gt.status = 'Open'
    ORDER BY gt.created_at DESC
  `, [facultyId]);
  return rows;
}

export async function resolveGrievance(ticketId: number, facultyId: number) {
  const [[ticket]] = await pool.query<any[]>(
    'SELECT * FROM grievance_ticket WHERE ticket_id = ?', [ticketId]
  );
  if (!ticket) throw new Error('Ticket not found.');
  if (ticket.assigned_authority_id !== facultyId) throw new Error('Not authorized for this ticket.');

  await pool.query(
    "UPDATE grievance_ticket SET status = 'Resolved' WHERE ticket_id = ?", [ticketId]
  );
}

// ── Notices ───────────────────────────────────────────────────

export async function getRelevantNotices() {
  const [rows] = await pool.query<any[]>(
    "SELECT * FROM notice_board ORDER BY created_at DESC LIMIT 15"
  );
  return rows;
}
