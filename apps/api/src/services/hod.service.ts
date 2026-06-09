import { prisma } from '@stratoserp/database';

// ── Faculty Management ────────────────────────────────────────

export async function assignSubjectToFaculty(subjectId: number, facultyId: number) {
  await prisma.timetableSlot.updateMany({
    where: { subjectId },
    data: { facultyId },
  });
}

export async function assignFacultyRole(facultyId: number, role: string) {
  const valid = ['Class Incharge', 'Subject Incharge', 'TG'];
  if (!valid.includes(role)) throw new Error('Invalid role designation.');
  await prisma.faculty.update({
    where: { facultyId },
    data: { designationRole: role },
  });
}

export async function listFacultyByDepartment() {
  return prisma.faculty.findMany({
    select: { facultyId: true, name: true, emailId: true, designationRole: true, isHod: true },
  });
}

// ── Branch Analytics ─────────────────────────────────────────

export async function getBranchAnalytics() {
  const students = await prisma.student.findMany({
    where: { academicYear: { not: 'Alumni' } },
    include: { subjectRecords: true },
  });

  let totalMarks = 0;
  let marksCount = 0;
  let totalKt = 0;
  let totalSuppli = 0;

  for (const s of students) {
    for (const r of s.subjectRecords) {
      if (r.marks !== null) {
        totalMarks += Number(r.marks);
        marksCount++;
      }
      if (r.status === 'KT') totalKt++;
      if (r.status === 'SUPPLI') totalSuppli++;
    }
  }

  const semesterDist = await prisma.student.groupBy({
    by: ['currentSemester'],
    where: { academicYear: { not: 'Alumni' } },
    _count: true,
    orderBy: { currentSemester: 'asc' },
  });

  return {
    summary: {
      total_students: students.length,
      avg_marks: marksCount > 0 ? totalMarks / marksCount : null,
      total_kt: totalKt,
      total_suppli: totalSuppli,
    },
    semester_distribution: semesterDist.map(d => ({
      current_semester: d.currentSemester,
      count: d._count,
    })),
  };
}

export async function getStudentDashboard(uid: string) {
  return prisma.studentSubjectRecord.findMany({
    where: { studentUid: uid },
    include: {
      student: true,
      subject: true,
    },
  });
}

export async function getAlumniData() {
  return prisma.student.findMany({
    where: { academicYear: 'Alumni' },
    select: { uid: true, emailId: true, academicYear: true },
    orderBy: { uid: 'asc' },
  });
}

// ── Grievance Escalation ──────────────────────────────────────

export async function getEscalatedGrievances() {
  return prisma.grievanceTicket.findMany({
    where: { status: 'Escalated' },
    include: { authority: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function resolveGrievance(ticketId: number) {
  await prisma.grievanceTicket.update({
    where: { ticketId },
    data: { status: 'Resolved' },
  });
}

// ── Leave Management ─────────────────────────────────────────

export async function getLeaveSubstitutionLog() {
  return prisma.leaveSubstitution.findMany({
    include: {
      absentFaculty: { select: { name: true } },
      substituteFaculty: { select: { name: true } },
    },
    orderBy: { leaveDate: 'desc' },
  });
}

export async function scheduleLeave(data: {
  absent_faculty_id: number; substitute_faculty_id: number; leave_date: string; type: string;
}) {
  const leaveDate = new Date(data.leave_date);
  const dayOfWeek = leaveDate.toLocaleDateString('en-US', { weekday: 'long' });

  const conflicts = await prisma.timetableSlot.findMany({
    where: { facultyId: data.substitute_faculty_id, dayOfWeek },
  });

  if (conflicts.length) {
    throw new Error('Substitute faculty has a timetable conflict on the specified date.');
  }

  const leave = await prisma.leaveSubstitution.create({
    data: {
      absentFacultyId: data.absent_faculty_id,
      substituteFacultyId: data.substitute_faculty_id,
      leaveDate,
      type: data.type,
    },
  });
  return leave.leaveId;
}

// ── Notice Board ─────────────────────────────────────────────

export async function createBranchNotice(title: string, aiTags?: string[]) {
  const notice = await prisma.noticeBoard.create({
    data: { title, targetAudience: 'BRANCH', aiFilterTags: aiTags || [] },
  });
  return notice.noticeId;
}

export async function getBranchNotices() {
  return prisma.noticeBoard.findMany({
    where: { targetAudience: 'BRANCH' },
    orderBy: { createdAt: 'desc' },
  });
}

// ── Study Materials Oversight ─────────────────────────────────

export async function getSubjectsList() {
  return prisma.subject.findMany({
    select: { subjectId: true, name: true, semesterLevel: true, hasLab: true },
    orderBy: [{ semesterLevel: 'asc' }, { name: 'asc' }],
  });
}
