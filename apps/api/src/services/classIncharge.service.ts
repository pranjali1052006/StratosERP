import { prisma } from '@stratoserp/database';

export async function getClassAnalytics(classId?: string) {
  const students = await prisma.student.findMany({
    where: { academicYear: { not: 'Alumni' } },
    include: { subjectRecords: true },
  });

  let totalMarks = 0;
  let marksCount = 0;
  let totalKt = 0;
  let totalSuppli = 0;
  let totalCleared = 0;

  for (const s of students) {
    for (const r of s.subjectRecords) {
      if (r.marks !== null) {
        totalMarks += Number(r.marks);
        marksCount++;
      }
      if (r.status === 'KT') totalKt++;
      if (r.status === 'SUPPLI') totalSuppli++;
      if (r.status === 'Cleared') totalCleared++;
    }
  }

  return {
    total_students: students.length,
    avg_marks: marksCount > 0 ? totalMarks / marksCount : null,
    total_kt: totalKt,
    total_suppli: totalSuppli,
    total_cleared: totalCleared,
  };
}

export async function getAtRiskStudents(): Promise<any[]> {
  const students = await prisma.student.findMany({
    where: {
      academicYear: { not: 'Alumni' },
      subjectRecords: {
        some: {
          OR: [
            { status: { in: ['KT', 'SUPPLI'] } },
            { marks: { lt: 40 } },
          ],
        },
      },
    },
    include: {
      subjectRecords: {
        where: {
          OR: [
            { status: { in: ['KT', 'SUPPLI'] } },
            { marks: { lt: 40 } },
          ],
        },
        include: { subject: { select: { name: true } } },
      },
    },
    orderBy: { uid: 'asc' },
  });

  return students.map(s => ({
    uid: s.uid,
    email_id: s.emailId,
    current_semester: s.currentSemester,
    academic_year: s.academicYear,
    backlog_subjects: s.subjectRecords.map(r => r.subject.name).join(', '),
  }));
}

export async function getStudentPortfolio(uid: string) {
  const student = await prisma.student.findUnique({ where: { uid } });
  if (!student) return null;

  const subjects = await prisma.studentSubjectRecord.findMany({
    where: { studentUid: uid },
    include: { subject: true },
    orderBy: [{ subject: { semesterLevel: 'asc' } }, { subject: { name: 'asc' } }],
  });

  const grievances = await prisma.grievanceTicket.findMany({
    where: { studentUid: uid },
    select: { ticketId: true, category: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  return {
    student,
    subjects: subjects.map(s => ({
      name: s.subject.name,
      semester_level: s.subject.semesterLevel,
      marks: s.marks,
      status: s.status,
    })),
    grievances,
    backlog_count: subjects.filter(s => ['KT', 'SUPPLI'].includes(s.status)).length,
  };
}

export async function getAllStudents() {
  const students = await prisma.student.findMany({
    where: { academicYear: { not: 'Alumni' } },
    include: {
      subjectRecords: {
        where: { status: { in: ['KT', 'SUPPLI'] } },
      },
    },
    orderBy: { uid: 'asc' },
  });

  return students.map(s => ({
    uid: s.uid,
    email_id: s.emailId,
    current_semester: s.currentSemester,
    academic_year: s.academicYear,
    backlogs: s.subjectRecords.length,
  }));
}

export async function getNoticesForClass() {
  return prisma.noticeBoard.findMany({
    where: { targetAudience: { in: ['INSTITUTE', 'BRANCH'] } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}

export async function createClassNotice(title: string, tags?: string[]) {
  const notice = await prisma.noticeBoard.create({
    data: { title, targetAudience: 'BRANCH', aiFilterTags: tags || [] },
  });
  return notice.noticeId;
}

export async function getProgressionReadiness(): Promise<any[]> {
  const students = await prisma.student.findMany({
    where: {
      academicYear: { not: 'Alumni' },
      subjectRecords: {
        none: { status: { in: ['KT', 'SUPPLI'] } },
      },
    },
    select: { uid: true, emailId: true, currentSemester: true, academicYear: true },
    orderBy: { uid: 'asc' },
  });
  return students;
}
