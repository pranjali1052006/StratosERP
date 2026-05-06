import { Request, Response } from 'express';
import * as siService from '../services/subjectIncharge.service';
import * as minioService from '../services/minio.service';
import * as geminiService from '../services/gemini.service';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
export const fileUpload = upload.single('file');

export async function getMySubjects(req: Request, res: Response): Promise<void> {
  const facultyId = req.user!.id as number;
  const data = await siService.getFacultySubjects(facultyId);
  res.json({ success: true, data });
}

export async function upsertMarks(req: Request, res: Response): Promise<void> {
  const { student_uid, subject_id, marks } = req.body;
  if (!student_uid || !subject_id || marks === undefined) {
    res.status(400).json({ success: false, message: 'student_uid, subject_id, marks required.' });
    return;
  }
  await siService.upsertMarks(student_uid, Number(subject_id), Number(marks));
  res.json({ success: true, message: 'Marks saved.' });
}

export async function upsertSuppliMarks(req: Request, res: Response): Promise<void> {
  const { student_uid, subject_id, marks } = req.body;
  if (!student_uid || !subject_id || marks === undefined) {
    res.status(400).json({ success: false, message: 'student_uid, subject_id, marks required.' });
    return;
  }
  await siService.upsertSuppliMarks(student_uid, Number(subject_id), Number(marks));
  res.json({ success: true, message: 'Supplementary marks saved.' });
}

export async function getSubjectMarks(req: Request, res: Response): Promise<void> {
  const { subject_id } = req.params;
  const data = await siService.getSubjectMarks(Number(subject_id));
  res.json({ success: true, data });
}

export async function getSubjectAnalytics(req: Request, res: Response): Promise<void> {
  const { subject_id } = req.params;
  const data = await siService.getSubjectAnalytics(Number(subject_id));
  res.json({ success: true, data });
}

export async function getActiveSlot(req: Request, res: Response): Promise<void> {
  const facultyId = req.user!.id as number;
  const slot = await siService.getActiveSlot(facultyId);
  if (!slot) {
    res.status(404).json({ success: false, message: 'No active slot for current time.' });
    return;
  }
  res.json({ success: true, data: slot });
}

export async function markAttendance(req: Request, res: Response): Promise<void> {
  const { slot_id, date, present_uids, absent_uids } = req.body;
  if (!slot_id || !date) {
    res.status(400).json({ success: false, message: 'slot_id and date required.' });
    return;
  }
  await siService.markAttendance(Number(slot_id), date, present_uids || [], absent_uids || []);
  res.json({ success: true, message: 'Attendance marked.' });
}

export async function getAttendance(req: Request, res: Response): Promise<void> {
  const { slot_id } = req.params;
  const { date } = req.query;
  const data = await siService.getAttendanceForSlot(Number(slot_id), date as string);
  res.json({ success: true, data });
}

export async function logLecture(req: Request, res: Response): Promise<void> {
  const { slot_id, syllabus_topics_taught, additional_topics_taught, execution_date } = req.body;
  if (!slot_id || !syllabus_topics_taught || !execution_date) {
    res.status(400).json({ success: false, message: 'slot_id, syllabus_topics_taught, execution_date required.' });
    return;
  }
  await siService.logLecture({ slot_id: Number(slot_id), syllabus_topics_taught, additional_topics_taught, execution_date });
  res.json({ success: true, message: 'Lecture logged.' });
}

export async function getLectureLogs(req: Request, res: Response): Promise<void> {
  const { subject_id } = req.params;
  const data = await siService.getLectureLogs(Number(subject_id));
  res.json({ success: true, data });
}

export async function uploadMaterial(req: Request, res: Response): Promise<void> {
  if (!req.file) { res.status(400).json({ success: false, message: 'File required.' }); return; }
  try {
    const { subject_id } = req.body;
    const objectName = `subject-${subject_id}/${Date.now()}-${req.file.originalname}`;
    const url = await minioService.uploadStudyMaterial(req.file.buffer, objectName, req.file.mimetype);
    res.status(201).json({ success: true, message: 'Material uploaded.', data: { url, object_name: objectName } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'File storage service unavailable.';
    res.status(503).json({ success: false, message });
  }
}

export async function syllabusAnalysis(req: Request, res: Response): Promise<void> {
  const { subject_id, syllabus_pdf_url, lecture_logs_summary } = req.body;
  if (!syllabus_pdf_url || !lecture_logs_summary) {
    res.status(400).json({ success: false, message: 'syllabus_pdf_url and lecture_logs_summary required.' });
    return;
  }
  const analysis = await geminiService.analyzeSyllabusPacing(lecture_logs_summary, syllabus_pdf_url);
  res.json({ success: true, data: analysis });
}
