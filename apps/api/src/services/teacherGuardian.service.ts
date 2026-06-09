import { prisma } from '@stratoserp/database';

// ── Mentee Management ─────────────────────────────────────────

export async function getMentees(tgFacultyId: number) {
  const assignments = await prisma.tgAssignment.findMany({
    where: { facultyId: tgFacultyId },
    include: {
      student: {
        include: {
          subjectRecords: {
            where: { status: { in: ['KT', 'SUPPLI'] } },
          },
        },
      },
    },
    orderBy: { student: { uid: 'asc' } },
  });

  return assignments.map(a => ({
    uid: a.student.uid,
    email_id: a.student.emailId,
    current_semester: a.student.currentSemester,
    academic_year: a.student.academicYear,
    backlogs: a.student.subjectRecords.length,
  }));
}

export async function getMenteePortfolio(tgFacultyId: number, studentUid: string) {
  const assignment = await prisma.tgAssignment.findFirst({
    where: { facultyId: tgFacultyId, studentUid },
  });
  if (!assignment) throw new Error('Student not in your mentee group.');

  const student = await prisma.student.findUnique({ where: { uid: studentUid } });

  const subjects = await prisma.studentSubjectRecord.findMany({
    where: { studentUid },
    include: { subject: true },
  });

  const aictePoints = await prisma.aictePoints.findMany({
    where: { studentUid },
    orderBy: { awardedAt: 'desc' },
  });

  const grievances = await prisma.grievanceTicket.findMany({
    where: { studentUid },
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
    aicte_points: aictePoints,
    grievances,
  };
}

// ── AICTE Points ──────────────────────────────────────────────

export async function awardAICTEPoints(data: {
  student_uid: string; activity: string; points: number; faculty_id: number;
}) {
  const record = await prisma.aictePoints.create({
    data: {
      studentUid: data.student_uid,
      activity: data.activity,
      points: data.points,
      awardedBy: data.faculty_id,
    },
  });
  return record.recordId;
}

export async function getAICTEPoints(studentUid: string) {
  const records = await prisma.aictePoints.findMany({
    where: { studentUid },
    orderBy: { awardedAt: 'desc' },
  });

  const total = records.reduce((sum, r) => sum + r.points, 0);
  return { records, total_points: total };
}

// ── Grievance Resolution ──────────────────────────────────────

export async function getAssignedGrievances(facultyId: number) {
  return prisma.grievanceTicket.findMany({
    where: { assignedAuthorityId: facultyId, status: 'Open' },
    include: { student: { select: { emailId: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function resolveGrievance(ticketId: number, facultyId: number) {
  const ticket = await prisma.grievanceTicket.findUnique({ where: { ticketId } });
  if (!ticket) throw new Error('Ticket not found.');
  if (ticket.assignedAuthorityId !== facultyId) throw new Error('Not authorized for this ticket.');

  await prisma.grievanceTicket.update({
    where: { ticketId },
    data: { status: 'Resolved' },
  });
}

// ── Notices ───────────────────────────────────────────────────

export async function getRelevantNotices() {
  return prisma.noticeBoard.findMany({
    orderBy: { createdAt: 'desc' },
    take: 15,
  });
}
