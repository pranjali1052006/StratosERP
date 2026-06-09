import { prisma } from '@stratoserp/database';

// ── Lab Sessions ─────────────────────────────────────────────

export async function getAssignedSessions(facultyId: number) {
  return prisma.labSession.findMany({
    where: { assignedFacultyId: facultyId },
    include: {
      batch: { select: { batchName: true } },
      subject: { select: { name: true } },
    },
    orderBy: { sessionDate: 'desc' },
  });
}

export async function createLabSession(data: {
  subject_id: number; batch_id: number; session_date: string; assigned_faculty_id: number;
}) {
  const session = await prisma.labSession.create({
    data: {
      subjectId: data.subject_id,
      batchId: data.batch_id,
      sessionDate: new Date(data.session_date),
      assignedFacultyId: data.assigned_faculty_id,
      status: 'Pending',
    },
  });
  return session.sessionId;
}

export async function completeSession(sessionId: number, facultyId: number) {
  const session = await prisma.labSession.findUnique({ where: { sessionId } });
  if (!session) throw new Error('Session not found.');
  if (session.assignedFacultyId !== facultyId) throw new Error('Not authorized for this session.');
  if (session.status === 'Locked') throw new Error('Session is already locked.');

  await prisma.labSession.update({
    where: { sessionId },
    data: { status: 'Completed' },
  });
}

export async function lockSession(sessionId: number, facultyId: number) {
  const session = await prisma.labSession.findUnique({ where: { sessionId } });
  if (!session) throw new Error('Session not found.');
  if (session.assignedFacultyId !== facultyId) throw new Error('Not authorized for this session.');
  if (session.status !== 'Completed') throw new Error('Session must be Completed before locking.');

  await prisma.labSession.update({
    where: { sessionId },
    data: { status: 'Locked' },
  });
}

// ── Lab Attendance ────────────────────────────────────────────

export async function markLabAttendance(
  sessionId: number, facultyId: number,
  attendanceList: { student_uid: string; status: string }[]
) {
  const session = await prisma.labSession.findUnique({ where: { sessionId } });
  if (!session) throw new Error('Session not found.');
  if (session.assignedFacultyId !== facultyId) throw new Error('Not authorized for this session.');
  if (session.status === 'Locked') throw new Error('Session is locked. Cannot modify attendance.');

  await prisma.$transaction(
    attendanceList.map(entry =>
      prisma.labAttendance.upsert({
        where: { sessionId_studentUid: { sessionId, studentUid: entry.student_uid } },
        update: { status: entry.status },
        create: { sessionId, studentUid: entry.student_uid, status: entry.status },
      })
    )
  );
}

export async function getLabAttendance(sessionId: number) {
  return prisma.labAttendance.findMany({
    where: { sessionId },
    include: { student: { select: { emailId: true } } },
    orderBy: { student: { uid: 'asc' } },
  });
}

// ── Experiment Marking ────────────────────────────────────────

export async function upsertLabMarks(data: {
  student_uid: string; subject_id: number; experiment_id: number; session_id: number;
  viva_marks: number; execution_marks: number; journal_marks: number; remarks?: string; faculty_id: number;
}) {
  const session = await prisma.labSession.findUnique({ where: { sessionId: data.session_id } });
  if (!session) throw new Error('Session not found.');
  if (session.assignedFacultyId !== data.faculty_id) throw new Error('Not authorized for this session.');
  if (session.status === 'Locked') throw new Error('Session is locked. Cannot modify marks.');

  const total = (data.viva_marks || 0) + (data.execution_marks || 0) + (data.journal_marks || 0);

  await prisma.labMark.upsert({
    where: { studentUid_experimentId: { studentUid: data.student_uid, experimentId: data.experiment_id } },
    update: {
      vivaMarks: data.viva_marks,
      executionMarks: data.execution_marks,
      journalMarks: data.journal_marks,
      totalMarks: total,
      remarks: data.remarks || null,
      updatedBy: data.faculty_id,
    },
    create: {
      studentUid: data.student_uid,
      subjectId: data.subject_id,
      experimentId: data.experiment_id,
      sessionId: data.session_id,
      vivaMarks: data.viva_marks,
      executionMarks: data.execution_marks,
      journalMarks: data.journal_marks,
      totalMarks: total,
      remarks: data.remarks || null,
      updatedBy: data.faculty_id,
    },
  });
}

export async function getLabMarksBySession(sessionId: number) {
  return prisma.labMark.findMany({
    where: { sessionId },
    include: {
      experiment: { select: { title: true } },
      student: { select: { emailId: true } },
    },
    orderBy: [{ student: { uid: 'asc' } }, { experiment: { experimentNo: 'asc' } }],
  });
}

// ── Experiments ───────────────────────────────────────────────

export async function getExperiments(subjectId: number) {
  return prisma.experiment.findMany({
    where: { subjectId },
    orderBy: { experimentNo: 'asc' },
  });
}

export async function createExperiment(data: { subject_id: number; experiment_no: number; title: string; max_marks: number }) {
  const experiment = await prisma.experiment.create({
    data: {
      subjectId: data.subject_id,
      experimentNo: data.experiment_no,
      title: data.title,
      maxMarks: data.max_marks,
    },
  });
  return experiment.experimentId;
}

// ── Lab Batches ───────────────────────────────────────────────

export async function getLabBatches(subjectId: number) {
  return prisma.labBatch.findMany({
    where: { subjectId },
    include: { faculty: { select: { name: true } } },
  });
}

export async function createLabBatch(data: { subject_id: number; batch_name: string; faculty_id: number }) {
  const batch = await prisma.labBatch.create({
    data: {
      subjectId: data.subject_id,
      batchName: data.batch_name,
      facultyId: data.faculty_id,
    },
  });
  return batch.batchId;
}

// ── Submission Tracking ───────────────────────────────────────

export async function getSubmissions(experimentId: number) {
  return prisma.labSubmission.findMany({
    where: { experimentId },
    include: { student: { select: { emailId: true } } },
    orderBy: { student: { uid: 'asc' } },
  });
}

export async function upsertSubmission(data: {
  student_uid: string; experiment_id: number; file_url?: string; status: string;
}) {
  await prisma.labSubmission.upsert({
    where: { submissionId: 0 }, // Will always create since we don't have a unique constraint
    update: { fileUrl: data.file_url || null, status: data.status },
    create: {
      studentUid: data.student_uid,
      experimentId: data.experiment_id,
      fileUrl: data.file_url || null,
      status: data.status,
    },
  });
}
