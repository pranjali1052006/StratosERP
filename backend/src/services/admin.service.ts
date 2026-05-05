import pool from '../config/database';
import bcrypt from 'bcryptjs';
import { parse } from 'csv-parse/sync';
import { SemesterType } from '../types';

// ── Global Config ────────────────────────────────────────────

export async function getGlobalConfig() {
  const [rows] = await pool.query<any[]>('SELECT * FROM global_config LIMIT 1');
  return rows[0] || null;
}

export async function setGlobalConfig(
  semesterType: SemesterType,
  startDate: string,
  endDate: string
) {
  // Business Rule: only ONE active config row at a time
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM global_config');
    const [result] = await conn.query<any>(
      'INSERT INTO global_config (active_semester_type, start_date, end_date) VALUES (?, ?, ?)',
      [semesterType, startDate, endDate]
    );
    await conn.commit();
    return result.insertId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ── Bulk CSV Ingestion ────────────────────────────────────────

export async function bulkIngestStudents(csvBuffer: Buffer): Promise<{ inserted: number; errors: string[] }> {
  const records: any[] = parse(csvBuffer, { columns: true, skip_empty_lines: true, trim: true });
  let inserted = 0;
  const errors: string[] = [];
  const UID_REGEX = /^\d{4}-[A-Z]{2,3}-[A-Z]-\d{2}-\d{4}$/;

  for (const row of records) {
    const { uid, email_id, current_semester, academic_year, password } = row;
    if (!UID_REGEX.test(uid)) {
      errors.push(`Invalid UID format: ${uid}`);
      continue;
    }
    try {
      const hash = await bcrypt.hash(password || 'Welcome@123', 12);
      await pool.query(
        'INSERT IGNORE INTO student (uid, email_id, current_semester, academic_year, password_hash) VALUES (?, ?, ?, ?, ?)',
        [uid, email_id, Number(current_semester), academic_year, hash]
      );
      inserted++;
    } catch (err: any) {
      errors.push(`Row ${uid}: ${err.message}`);
    }
  }
  return { inserted, errors };
}

export async function bulkIngestFaculty(csvBuffer: Buffer): Promise<{ inserted: number; errors: string[] }> {
  const records: any[] = parse(csvBuffer, { columns: true, skip_empty_lines: true, trim: true });
  let inserted = 0;
  const errors: string[] = [];

  for (const row of records) {
    const { name, email_id, designation_role, is_admin, is_hod, password } = row;
    try {
      const hash = await bcrypt.hash(password || 'Faculty@123', 12);
      await pool.query(
        'INSERT IGNORE INTO faculty (name, email_id, designation_role, is_admin, is_hod, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
        [name, email_id, designation_role, is_admin === 'true' ? 1 : 0, is_hod === 'true' ? 1 : 0, hash]
      );
      inserted++;
    } catch (err: any) {
      errors.push(`Row ${email_id}: ${err.message}`);
    }
  }
  return { inserted, errors };
}

export async function bulkIngestSubjects(csvBuffer: Buffer): Promise<{ inserted: number; errors: string[] }> {
  const records: any[] = parse(csvBuffer, { columns: true, skip_empty_lines: true, trim: true });
  let inserted = 0;
  const errors: string[] = [];

  for (const row of records) {
    const { name, semester_level, has_lab, lab_marks_weight } = row;
    try {
      await pool.query(
        'INSERT IGNORE INTO subject (name, semester_level, has_lab, lab_marks_weight) VALUES (?, ?, ?, ?)',
        [name, Number(semester_level), has_lab === 'true' ? 1 : 0, lab_marks_weight ? Number(lab_marks_weight) : null]
      );
      inserted++;
    } catch (err: any) {
      errors.push(`Row ${name}: ${err.message}`);
    }
  }
  return { inserted, errors };
}

export async function bulkIngestTimetable(csvBuffer: Buffer): Promise<{ inserted: number; errors: string[] }> {
  const records: any[] = parse(csvBuffer, { columns: true, skip_empty_lines: true, trim: true });
  let inserted = 0;
  const errors: string[] = [];

  for (const row of records) {
    const { day_of_week, start_time, end_time, subject_id, faculty_id } = row;
    try {
      await pool.query(
        'INSERT IGNORE INTO timetable_slot (day_of_week, start_time, end_time, subject_id, faculty_id) VALUES (?, ?, ?, ?, ?)',
        [day_of_week, start_time, end_time, Number(subject_id), Number(faculty_id)]
      );
      inserted++;
    } catch (err: any) {
      errors.push(`Row: ${err.message}`);
    }
  }
  return { inserted, errors };
}

// ── Batch Progression ─────────────────────────────────────────

export async function triggerBatchProgression(): Promise<{ progressed: number; alumniTransitions: number }> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Progress students: increment semester by 1 (if not Alumni and no KT backlogs)
    const [studentsToProgress] = await conn.query<any[]>(`
      SELECT s.uid, s.current_semester, s.academic_year
      FROM student s
      WHERE s.academic_year != 'Alumni'
        AND s.uid NOT IN (
          SELECT DISTINCT student_uid FROM student_subject_record WHERE status IN ('KT', 'SUPPLI')
        )
    `);

    let progressed = 0;
    let alumniTransitions = 0;

    for (const student of studentsToProgress) {
      const newSemester = student.current_semester + 1;
      if (newSemester > 8) {
        // Transition to Alumni
        await conn.query(
          "UPDATE student SET academic_year = 'Alumni', current_semester = 8 WHERE uid = ?",
          [student.uid]
        );
        alumniTransitions++;
      } else {
        const newYear = newSemester <= 2 ? '1st' : newSemester <= 4 ? '2nd' : newSemester <= 6 ? '3rd' : '4th';
        await conn.query(
          'UPDATE student SET current_semester = ?, academic_year = ? WHERE uid = ?',
          [newSemester, newYear, student.uid]
        );
        progressed++;
      }
    }

    await conn.commit();
    return { progressed, alumniTransitions };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ── Exam Seating Matrix ───────────────────────────────────────

export interface ClassroomCapacity {
  room: string;
  capacity: number;
}

export async function generateExamSeating(classrooms: ClassroomCapacity[]): Promise<any[]> {
  const [students] = await pool.query<any[]>(
    "SELECT uid, current_semester FROM student WHERE academic_year != 'Alumni' ORDER BY current_semester, uid"
  );

  const seating: any[] = [];
  let studentIdx = 0;

  for (const room of classrooms) {
    const roomStudents = students.slice(studentIdx, studentIdx + room.capacity);
    for (let seat = 0; seat < roomStudents.length; seat++) {
      seating.push({
        room: room.room,
        seat_number: seat + 1,
        student_uid: roomStudents[seat].uid,
        semester: roomStudents[seat].current_semester,
      });
    }
    studentIdx += room.capacity;
    if (studentIdx >= students.length) break;
  }
  return seating;
}

// ── Invigilation Matrix ───────────────────────────────────────

export async function generateInvigilationMatrix(examDate: string): Promise<any[]> {
  const [faculty] = await pool.query<any[]>(`
    SELECT f.faculty_id, f.name,
           COUNT(ls.leave_id) AS on_leave
    FROM faculty f
    LEFT JOIN leave_substitution ls ON f.faculty_id = ls.absent_faculty_id AND ls.leave_date = ?
    WHERE f.is_admin = 0
    GROUP BY f.faculty_id
    HAVING on_leave = 0
    ORDER BY f.faculty_id
  `, [examDate]);

  // Simple round-robin duty assignment
  return faculty.map((f, idx) => ({
    faculty_id: f.faculty_id,
    name: f.name,
    duty_slot: `Slot ${(idx % 3) + 1}`,
    exam_date: examDate,
  }));
}

// ── Analytics ────────────────────────────────────────────────

export async function getMacroAnalytics() {
  const [[studentCount]] = await pool.query<any[]>('SELECT COUNT(*) AS total FROM student');
  const [[facultyCount]] = await pool.query<any[]>('SELECT COUNT(*) AS total FROM faculty');
  const [[subjectCount]] = await pool.query<any[]>('SELECT COUNT(*) AS total FROM subject');
  const [[ktCount]] = await pool.query<any[]>(
    "SELECT COUNT(*) AS total FROM student_subject_record WHERE status = 'KT'"
  );
  const [[suppliCount]] = await pool.query<any[]>(
    "SELECT COUNT(*) AS total FROM student_subject_record WHERE status = 'SUPPLI'"
  );
  const [[alumniCount]] = await pool.query<any[]>(
    "SELECT COUNT(*) AS total FROM student WHERE academic_year = 'Alumni'"
  );
  const config = await getGlobalConfig();

  return {
    total_students: studentCount.total,
    total_faculty: facultyCount.total,
    total_subjects: subjectCount.total,
    kt_records: ktCount.total,
    suppli_records: suppliCount.total,
    alumni_count: alumniCount.total,
    global_config: config,
  };
}

// ── Faculty & Student Management ─────────────────────────────

export async function createFaculty(data: {
  name: string; email_id: string; designation_role: string; is_admin?: boolean; is_hod?: boolean; password: string;
}) {
  const hash = await bcrypt.hash(data.password, 12);
  const [result] = await pool.query<any>(
    'INSERT INTO faculty (name, email_id, designation_role, is_admin, is_hod, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
    [data.name, data.email_id, data.designation_role, data.is_admin ? 1 : 0, data.is_hod ? 1 : 0, hash]
  );
  return result.insertId;
}

export async function listAllFaculty() {
  const [rows] = await pool.query<any[]>('SELECT faculty_id, name, email_id, designation_role, is_admin, is_hod FROM faculty');
  return rows;
}

export async function listAllStudents(page = 1, limit = 50) {
  const offset = (page - 1) * limit;
  const [rows] = await pool.query<any[]>(
    'SELECT uid, email_id, current_semester, academic_year FROM student ORDER BY uid LIMIT ? OFFSET ?',
    [limit, offset]
  );
  const [[{ total }]] = await pool.query<any[]>('SELECT COUNT(*) AS total FROM student');
  return { students: rows, total, page, limit };
}

export async function getAlumniRecords() {
  const [rows] = await pool.query<any[]>(
    "SELECT uid, email_id, academic_year FROM student WHERE academic_year = 'Alumni' ORDER BY uid"
  );
  return rows;
}

// ── Notice Board ─────────────────────────────────────────────

export async function createNotice(data: {
  title: string; target_audience: string; ai_filter_tags?: string[];
}) {
  const [result] = await pool.query<any>(
    'INSERT INTO notice_board (title, target_audience, ai_filter_tags) VALUES (?, ?, ?)',
    [data.title, data.target_audience, JSON.stringify(data.ai_filter_tags || [])]
  );
  return result.insertId;
}

export async function listNotices(audience?: string) {
  if (audience) {
    const [rows] = await pool.query<any[]>('SELECT * FROM notice_board WHERE target_audience = ? ORDER BY created_at DESC', [audience]);
    return rows;
  }
  const [rows] = await pool.query<any[]>('SELECT * FROM notice_board ORDER BY created_at DESC');
  return rows;
}
