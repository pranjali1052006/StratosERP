import { prisma } from '@stratoserp/database';

function isYearBack(academicYear: string, currentSemester: number): boolean {
  if (academicYear === '1st') return ![1, 2].includes(currentSemester);
  if (academicYear === '2nd') return ![3, 4].includes(currentSemester);
  if (academicYear === '3rd') return ![5, 6].includes(currentSemester);
  if (academicYear === '4th') return ![7, 8].includes(currentSemester);
  return false;
}

// ── Dashboard ─────────────────────────────────────────────────

export async function getStudentDashboard(uid: string) {
  const student = await prisma.student.findUnique({
    where: { uid },
    select: { uid: true, emailId: true, currentSemester: true, academicYear: true },
  });
  if (!student) return null;

  const subjects = await prisma.studentSubjectRecord.findMany({
    where: { studentUid: uid },
    include: { subject: true },
    orderBy: [{ subject: { semesterLevel: 'desc' } }, { subject: { name: 'asc' } }],
  });

  const ktCount = subjects.filter(s => s.status === 'KT').length;
  const suppliCount = subjects.filter(s => s.status === 'SUPPLI').length;
  const hasKt = ktCount > 0;
  const hasSuppli = suppliCount > 0;
  const yearBack = isYearBack(student.academicYear, student.currentSemester);

  const aicte = await getAICTETotal(uid);

  const progressionStatus = {
    has_kt: hasKt,
    has_suppli: hasSuppli,
    is_year_back: yearBack,
    kt_count: ktCount,
    suppli_count: suppliCount,
    promotion_blocked: hasKt || hasSuppli,
    dashboard_flag: yearBack
      ? 'YEAR_BACK_ATTENTION'
      : hasKt || hasSuppli
      ? 'BACKLOG_ATTENTION'
      : 'ON_TRACK',
  };

  return {
    student,
    progression_status: progressionStatus,
    subjects: subjects.map(s => ({
      subject_id: s.subject.subjectId,
      name: s.subject.name,
      semester_level: s.subject.semesterLevel,
      has_lab: s.subject.hasLab,
      marks: s.marks,
      status: s.status,
    })),
    aicte_total_points: aicte,
  };
}

export async function getAICTETotal(uid: string): Promise<number> {
  const result = await prisma.aictePoints.aggregate({
    where: { studentUid: uid },
    _sum: { points: true },
  });
  return result._sum.points ?? 0;
}

// ── Timetable & Live Faculty Locator ──────────────────────────

export async function getTimetable(uid: string) {
  const student = await prisma.student.findUnique({
    where: { uid },
    select: { currentSemester: true },
  });
  if (!student) return null;

  return prisma.timetableSlot.findMany({
    where: { subject: { semesterLevel: student.currentSemester } },
    include: {
      subject: { select: { name: true } },
      faculty: { select: { name: true } },
    },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
}

export async function liveFacultyLocator() {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const now = new Date();
  const today = days[now.getDay()];
  const currentTime = new Date(`1970-01-01T${now.toTimeString().slice(0, 8)}`);

  return prisma.timetableSlot.findMany({
    where: {
      dayOfWeek: today,
      startTime: { lte: currentTime },
      endTime: { gte: currentTime },
    },
    include: {
      subject: { select: { name: true } },
      faculty: { select: { facultyId: true, name: true } },
    },
  });
}

// ── Grievance Portal ──────────────────────────────────────────

export async function submitGrievance(data: {
  student_uid: string; category: string; description: string; evidence?: string;
}) {
  const ticket = await prisma.grievanceTicket.create({
    data: {
      studentUid: data.student_uid,
      category: data.category,
      description: data.description,
      evidence: data.evidence || null,
      status: 'Open',
    },
  });
  return ticket.ticketId;
}

export async function getMyGrievances(uid: string) {
  return prisma.grievanceTicket.findMany({
    where: { studentUid: uid },
    include: { authority: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

// ── Notice Board ──────────────────────────────────────────────

export async function getNotices() {
  return prisma.noticeBoard.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}

// ── Study Materials ───────────────────────────────────────────

export async function getStudyMaterials(subjectId: number) {
  return { subject_id: subjectId, note: 'Use /api/student/materials/:subject_id/download endpoint with object_name param.' };
}

// ── Lab Marks ─────────────────────────────────────────────────

export async function getLabMarks(uid: string) {
  return prisma.labMark.findMany({
    where: { studentUid: uid },
    include: {
      experiment: { select: { title: true } },
      subject: { select: { name: true } },
    },
    orderBy: [{ subject: { name: 'asc' } }, { experiment: { experimentNo: 'asc' } }],
  });
}
