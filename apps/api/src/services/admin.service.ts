import { prisma } from '@stratoserp/database';
import bcrypt from 'bcryptjs';
import { parse } from 'csv-parse/sync';
import { SemesterType } from '../types';

type AcademicYearBucket = '1st' | '2nd' | '3rd' | '4th';

const YEAR_ORDER: AcademicYearBucket[] = ['1st', '2nd', '3rd', '4th'];

const ODD_SEM_BY_YEAR: Record<AcademicYearBucket, number> = {
  '1st': 1,
  '2nd': 3,
  '3rd': 5,
  '4th': 7,
};

const EVEN_SEM_BY_YEAR: Record<AcademicYearBucket, number> = {
  '1st': 2,
  '2nd': 4,
  '3rd': 6,
  '4th': 8,
};

const NEXT_YEAR: Partial<Record<AcademicYearBucket, AcademicYearBucket>> = {
  '1st': '2nd',
  '2nd': '3rd',
  '3rd': '4th',
};

function isYearBack(academicYear: string, currentSemester: number): boolean {
  if (academicYear === '1st') return ![1, 2].includes(currentSemester);
  if (academicYear === '2nd') return ![3, 4].includes(currentSemester);
  if (academicYear === '3rd') return ![5, 6].includes(currentSemester);
  if (academicYear === '4th') return ![7, 8].includes(currentSemester);
  return false;
}

// ── Global Config ────────────────────────────────────────────

export async function getGlobalConfig() {
  return prisma.globalConfig.findFirst();
}

export async function setGlobalConfig(
  semesterType: SemesterType,
  startDate: string,
  endDate: string
) {
  // Business Rule: only ONE active config row at a time
  return prisma.$transaction(async (tx) => {
    await tx.globalConfig.deleteMany();
    const config = await tx.globalConfig.create({
      data: {
        activeSemesterType: semesterType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });
    return config.configId;
  });
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
      await prisma.student.upsert({
        where: { uid },
        update: {},
        create: {
          uid,
          emailId: email_id,
          currentSemester: Number(current_semester),
          academicYear: academic_year,
          passwordHash: hash,
        },
      });
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
    const { name, email_id, designation_role, is_hod, password } = row;
    try {
      const hash = await bcrypt.hash(password || 'Faculty@123', 12);
      await prisma.faculty.upsert({
        where: { emailId: email_id },
        update: {},
        create: {
          name,
          emailId: email_id,
          designationRole: designation_role,
          isHod: is_hod === 'true',
          passwordHash: hash,
        },
      });
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
      await prisma.subject.create({
        data: {
          name,
          semesterLevel: Number(semester_level),
          hasLab: has_lab === 'true',
          labMarksWeight: lab_marks_weight ? Number(lab_marks_weight) : null,
        },
      });
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
      await prisma.timetableSlot.create({
        data: {
          dayOfWeek: day_of_week,
          startTime: new Date(`1970-01-01T${start_time}`),
          endTime: new Date(`1970-01-01T${end_time}`),
          subjectId: Number(subject_id),
          facultyId: Number(faculty_id),
        },
      });
      inserted++;
    } catch (err: any) {
      errors.push(`Row: ${err.message}`);
    }
  }
  return { inserted, errors };
}

// ── Batch Progression ─────────────────────────────────────────

export async function triggerBatchProgression(): Promise<{ progressed: number; alumniTransitions: number }> {
  return prisma.$transaction(async (tx) => {
    // Find students with backlogs
    const studentsWithBacklogs = await tx.studentSubjectRecord.findMany({
      where: { status: { in: ['KT', 'SUPPLI'] } },
      select: { studentUid: true },
      distinct: ['studentUid'],
    });
    const blockedUids = new Set(studentsWithBacklogs.map(r => r.studentUid));

    const studentsToProgress = await tx.student.findMany({
      where: {
        academicYear: { not: 'Alumni' },
        uid: { notIn: [...blockedUids] },
      },
    });

    let progressed = 0;
    let alumniTransitions = 0;

    for (const student of studentsToProgress) {
      const newSemester = student.currentSemester + 1;
      if (newSemester > 8) {
        await tx.student.update({
          where: { uid: student.uid },
          data: { academicYear: 'Alumni', currentSemester: 8 },
        });
        alumniTransitions++;
      } else {
        const newYear = newSemester <= 2 ? '1st' : newSemester <= 4 ? '2nd' : newSemester <= 6 ? '3rd' : '4th';
        await tx.student.update({
          where: { uid: student.uid },
          data: { currentSemester: newSemester, academicYear: newYear },
        });
        progressed++;
      }
    }

    return { progressed, alumniTransitions };
  });
}

export async function getSemesterProgressionOverview() {
  const config = await getGlobalConfig();
  const activeSemesterType = (config?.activeSemesterType as SemesterType) || 'ODD';

  const students = await prisma.student.findMany({
    where: { academicYear: { in: ['1st', '2nd', '3rd', '4th'] } },
    include: {
      subjectRecords: {
        where: { status: { in: ['KT', 'SUPPLI'] } },
        select: { studentUid: true },
      },
    },
  });

  const years = YEAR_ORDER.map((year) => {
    const oddSemester = ODD_SEM_BY_YEAR[year];
    const evenSemester = EVEN_SEM_BY_YEAR[year];

    const yearStudents = students.filter(s => s.academicYear === year);
    const oddStudents = yearStudents.filter(s => s.currentSemester === oddSemester);
    const evenStudents = yearStudents.filter(s => s.currentSemester === evenSemester);

    const oddBlocked = oddStudents.filter(s => s.subjectRecords.length > 0).length;
    const evenBlocked = evenStudents.filter(s => s.subjectRecords.length > 0).length;
    const yearBackCount = yearStudents.filter(s => isYearBack(s.academicYear, s.currentSemester)).length;

    let nextActionLabel = 'Promote to Even Semester';
    if (activeSemesterType === 'EVEN') {
      nextActionLabel = year === '4th' ? 'Move to Alumni' : 'Promote to Next Year';
    }

    return {
      academic_year: year,
      odd_semester: oddSemester,
      even_semester: evenSemester,
      odd_strength: oddStudents.length,
      even_strength: evenStudents.length,
      odd_blocked: oddBlocked,
      even_blocked: evenBlocked,
      year_back_count: yearBackCount,
      next_action_label: nextActionLabel,
    };
  });

  return { active_semester_type: activeSemesterType, years };
}

export async function promoteAcademicYear(
  academicYear: AcademicYearBucket,
  semesterType: SemesterType
): Promise<{
  academic_year: AcademicYearBucket;
  semester_type: SemesterType;
  targeted_semester: number;
  progressed: number;
  alumniTransitions: number;
  blockedSkipped: number;
  yearBackSkipped: number;
}> {
  const targetedSemester = semesterType === 'ODD'
    ? ODD_SEM_BY_YEAR[academicYear]
    : EVEN_SEM_BY_YEAR[academicYear];

  return prisma.$transaction(async (tx) => {
    const targetStudents = await tx.student.findMany({
      where: { academicYear, NOT: { academicYear: 'Alumni' } },
      include: {
        subjectRecords: {
          where: { status: { in: ['KT', 'SUPPLI'] } },
          select: { studentUid: true },
        },
      },
    });

    const inTargetSemester = targetStudents.filter(s => s.currentSemester === targetedSemester);
    const blockedSkipped = inTargetSemester.filter(s => s.subjectRecords.length > 0).length;
    const eligible = inTargetSemester.filter(s => s.subjectRecords.length === 0);
    const yearBackSkipped = targetStudents.filter(s => s.currentSemester !== targetedSemester).length;

    let progressed = 0;
    let alumniTransitions = 0;

    for (const student of eligible) {
      if (semesterType === 'ODD') {
        await tx.student.update({
          where: { uid: student.uid },
          data: { currentSemester: student.currentSemester + 1 },
        });
        progressed++;
        continue;
      }

      if (student.currentSemester === 8) {
        await tx.student.update({
          where: { uid: student.uid },
          data: { academicYear: 'Alumni', currentSemester: 8 },
        });
        alumniTransitions++;
        continue;
      }

      const nextYear = NEXT_YEAR[academicYear];
      if (!nextYear) continue;

      await tx.student.update({
        where: { uid: student.uid },
        data: { currentSemester: student.currentSemester + 1, academicYear: nextYear },
      });
      progressed++;
    }

    return {
      academic_year: academicYear,
      semester_type: semesterType,
      targeted_semester: targetedSemester,
      progressed,
      alumniTransitions,
      blockedSkipped,
      yearBackSkipped,
    };
  });
}

// ── Exam Seating Matrix ───────────────────────────────────────

export interface ClassroomCapacity {
  room: string;
  capacity: number;
}

export async function generateExamSeating(classrooms: ClassroomCapacity[]): Promise<any[]> {
  const students = await prisma.student.findMany({
    where: { academicYear: { not: 'Alumni' } },
    orderBy: [{ currentSemester: 'asc' }, { uid: 'asc' }],
  });

  const seating: any[] = [];
  let studentIdx = 0;

  for (const room of classrooms) {
    const roomStudents = students.slice(studentIdx, studentIdx + room.capacity);
    for (let seat = 0; seat < roomStudents.length; seat++) {
      seating.push({
        room: room.room,
        seat_number: seat + 1,
        student_uid: roomStudents[seat].uid,
        semester: roomStudents[seat].currentSemester,
      });
    }
    studentIdx += room.capacity;
    if (studentIdx >= students.length) break;
  }
  return seating;
}

// ── Invigilation Matrix ───────────────────────────────────────

export async function generateInvigilationMatrix(examDate: string): Promise<any[]> {
  const faculty = await prisma.faculty.findMany({
    where: {
      leaveAbsences: {
        none: { leaveDate: new Date(examDate) },
      },
    },
    orderBy: { facultyId: 'asc' },
  });

  return faculty.map((f, idx) => ({
    faculty_id: f.facultyId,
    name: f.name,
    duty_slot: `Slot ${(idx % 3) + 1}`,
    exam_date: examDate,
  }));
}

// ── Analytics ────────────────────────────────────────────────

export async function getMacroAnalytics() {
  const [totalStudents, totalFaculty, totalSubjects, ktCount, suppliCount, alumniCount, config] =
    await Promise.all([
      prisma.student.count(),
      prisma.faculty.count(),
      prisma.subject.count(),
      prisma.studentSubjectRecord.count({ where: { status: 'KT' } }),
      prisma.studentSubjectRecord.count({ where: { status: 'SUPPLI' } }),
      prisma.student.count({ where: { academicYear: 'Alumni' } }),
      getGlobalConfig(),
    ]);

  return {
    total_students: totalStudents,
    total_faculty: totalFaculty,
    total_subjects: totalSubjects,
    kt_records: ktCount,
    suppli_records: suppliCount,
    alumni_count: alumniCount,
    global_config: config,
  };
}

// ── Faculty & Student Management ─────────────────────────────

export async function createFaculty(data: {
  name: string; email_id: string; designation_role: string; is_hod?: boolean; password: string;
}) {
  const hash = await bcrypt.hash(data.password, 12);
  const faculty = await prisma.faculty.create({
    data: {
      name: data.name,
      emailId: data.email_id,
      designationRole: data.designation_role,
      isHod: data.is_hod ?? false,
      passwordHash: hash,
    },
  });
  return faculty.facultyId;
}

export async function listAllFaculty() {
  return prisma.faculty.findMany({
    select: { facultyId: true, name: true, emailId: true, designationRole: true, isHod: true },
  });
}

export async function listAllStudents(page = 1, limit = 50) {
  const [students, total] = await Promise.all([
    prisma.student.findMany({
      select: { uid: true, emailId: true, currentSemester: true, academicYear: true },
      orderBy: { uid: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.student.count(),
  ]);
  return { students, total, page, limit };
}

export async function getAlumniRecords() {
  return prisma.student.findMany({
    where: { academicYear: 'Alumni' },
    select: { uid: true, emailId: true, academicYear: true },
    orderBy: { uid: 'asc' },
  });
}

// ── Notice Board ─────────────────────────────────────────────

export async function createNotice(data: {
  title: string; target_audience: string; ai_filter_tags?: string[];
}) {
  const notice = await prisma.noticeBoard.create({
    data: {
      title: data.title,
      targetAudience: data.target_audience,
      aiFilterTags: data.ai_filter_tags || [],
    },
  });
  return notice.noticeId;
}

export async function listNotices(audience?: string) {
  return prisma.noticeBoard.findMany({
    where: audience ? { targetAudience: audience } : undefined,
    orderBy: { createdAt: 'desc' },
  });
}
