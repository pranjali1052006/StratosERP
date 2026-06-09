// =============================================================
// @stratoserp/database — Public API
// =============================================================

// Re-export the singleton Prisma client
export { prisma, default } from './client';

// Re-export all generated Prisma types for convenience
export type {
  Subject,
  GlobalConfig,
  Faculty,
  AdminUser,
  Student,
  StudentSubjectRecord,
  TimetableSlot,
  LectureLog,
  GrievanceTicket,
  LeaveSubstitution,
  NoticeBoard,
  LabBatch,
  Experiment,
  LabSession,
  LabAttendance,
  LabMark,
  LabSubmission,
  AictePoints,
  TgAssignment,
  Prisma,
} from '@prisma/client';

export { PrismaClient } from '@prisma/client';
