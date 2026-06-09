import { prisma } from '@stratoserp/database';

// ── Marks Management ─────────────────────────────────────────

export async function upsertMarks(studentUid: string, subjectId: number, marks: number) {
  await prisma.studentSubjectRecord.upsert({
    where: { studentUid_subjectId: { studentUid, subjectId } },
    update: { marks },
    create: { studentUid, subjectId, status: 'Active', marks },
  });
}

export async function upsertSuppliMarks(studentUid: string, subjectId: number, marks: number) {
  const status = marks >= 40 ? 'Cleared' : 'SUPPLI';
  await prisma.studentSubjectRecord.upsert({
    where: { studentUid_subjectId: { studentUid, subjectId } },
    update: { marks, status },
    create: { studentUid, subjectId, status, marks },
  });
}

export async function getSubjectMarks(subjectId: number) {
  return prisma.studentSubjectRecord.findMany({
    where: { subjectId },
    include: { student: { select: { uid: true, emailId: true } } },
    orderBy: { student: { uid: 'asc' } },
  });
}

export async function getSubjectAnalytics(subjectId: number) {
  const records = await prisma.studentSubjectRecord.findMany({
    where: { subjectId },
  });

  const marksValues = records.filter(r => r.marks !== null).map(r => Number(r.marks));

  return {
    total_enrolled: records.length,
    avg_marks: marksValues.length > 0 ? marksValues.reduce((a, b) => a + b, 0) / marksValues.length : null,
    max_marks: marksValues.length > 0 ? Math.max(...marksValues) : null,
    min_marks: marksValues.length > 0 ? Math.min(...marksValues) : null,
    kt_count: records.filter(r => r.status === 'KT').length,
    suppli_count: records.filter(r => r.status === 'SUPPLI').length,
    cleared_count: records.filter(r => r.status === 'Cleared').length,
  };
}

// ── Smart Attendance ──────────────────────────────────────────

export async function getActiveSlot(facultyId: number): Promise<any> {
  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = days[now.getDay()];
  const currentTime = new Date(`1970-01-01T${now.toTimeString().slice(0, 8)}`);

  const slot = await prisma.timetableSlot.findFirst({
    where: {
      facultyId,
      dayOfWeek: today,
      startTime: { lte: currentTime },
      endTime: { gte: currentTime },
    },
    include: { subject: { select: { name: true } } },
  });

  if (!slot) return null;
  return { slot_id: slot.slotId, subject_id: slot.subjectId, subject_name: slot.subject.name };
}

export async function markAttendance(
  slotId: number,
  attendanceDate: string,
  presentUids: string[],
  absentUids: string[]
) {
  await prisma.$transaction(async (tx) => {
    // Ensure lecture_log exists for this slot+date
    await tx.lectureLog.upsert({
      where: { slotId_executionDate: { slotId, executionDate: new Date(attendanceDate) } },
      update: {
        additionalTopicsTaught: JSON.stringify({ present: presentUids, absent: absentUids }),
      },
      create: {
        slotId,
        executionDate: new Date(attendanceDate),
        additionalTopicsTaught: JSON.stringify({ present: presentUids, absent: absentUids }),
      },
    });
  });
}

export async function getAttendanceForSlot(slotId: number, date: string) {
  const log = await prisma.lectureLog.findUnique({
    where: { slotId_executionDate: { slotId, executionDate: new Date(date) } },
  });

  if (!log?.additionalTopicsTaught) return null;
  return JSON.parse(log.additionalTopicsTaught);
}

// ── Lecture Logs ──────────────────────────────────────────────

export async function logLecture(data: {
  slot_id: number; syllabus_topics_taught: string; additional_topics_taught?: string; execution_date: string;
}) {
  await prisma.lectureLog.upsert({
    where: { slotId_executionDate: { slotId: data.slot_id, executionDate: new Date(data.execution_date) } },
    update: {
      syllabusTopicsTaught: data.syllabus_topics_taught,
      additionalTopicsTaught: data.additional_topics_taught || null,
    },
    create: {
      slotId: data.slot_id,
      syllabusTopicsTaught: data.syllabus_topics_taught,
      additionalTopicsTaught: data.additional_topics_taught || null,
      executionDate: new Date(data.execution_date),
    },
  });
}

export async function getLectureLogs(subjectId: number) {
  return prisma.lectureLog.findMany({
    where: { slot: { subjectId } },
    include: {
      slot: {
        select: { dayOfWeek: true, startTime: true, endTime: true },
      },
    },
    orderBy: { executionDate: 'desc' },
  });
}

// ── Faculty's Subjects ────────────────────────────────────────

export async function getFacultySubjects(facultyId: number) {
  const slots = await prisma.timetableSlot.findMany({
    where: { facultyId },
    include: { subject: true },
    distinct: ['subjectId'],
  });

  return slots.map(s => ({
    subject_id: s.subject.subjectId,
    name: s.subject.name,
    semester_level: s.subject.semesterLevel,
    has_lab: s.subject.hasLab,
  }));
}
