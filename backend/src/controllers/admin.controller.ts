import { Request, Response } from 'express';
import * as adminService from '../services/admin.service';
import * as geminiService from '../services/gemini.service';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
export const csvUpload = upload.single('file');

// ── Global Config ────────────────────────────────────────────

export async function getGlobalConfig(req: Request, res: Response): Promise<void> {
  const config = await adminService.getGlobalConfig();
  res.json({ success: true, data: config });
}

export async function setGlobalConfig(req: Request, res: Response): Promise<void> {
  const { active_semester_type, semester_type, start_date, end_date } = req.body;
  const semType = active_semester_type || semester_type;
  if (!semType || !start_date || !end_date) {
    res.status(400).json({ success: false, message: 'active_semester_type, start_date, and end_date are required.' });
    return;
  }
  const id = await adminService.setGlobalConfig(semType, start_date, end_date);
  res.status(201).json({ success: true, message: 'Global config set.', data: { config_id: id } });
}

// ── CSV Ingestion ────────────────────────────────────────────

export async function ingestStudents(req: Request, res: Response): Promise<void> {
  if (!req.file) { res.status(400).json({ success: false, message: 'CSV file required.' }); return; }
  const result = await adminService.bulkIngestStudents(req.file.buffer);
  res.json({ success: true, message: `Ingested ${result.inserted} students.`, data: result });
}

export async function ingestFaculty(req: Request, res: Response): Promise<void> {
  if (!req.file) { res.status(400).json({ success: false, message: 'CSV file required.' }); return; }
  const result = await adminService.bulkIngestFaculty(req.file.buffer);
  res.json({ success: true, message: `Ingested ${result.inserted} faculty.`, data: result });
}

export async function ingestSubjects(req: Request, res: Response): Promise<void> {
  if (!req.file) { res.status(400).json({ success: false, message: 'CSV file required.' }); return; }
  const result = await adminService.bulkIngestSubjects(req.file.buffer);
  res.json({ success: true, message: `Ingested ${result.inserted} subjects.`, data: result });
}

export async function ingestTimetable(req: Request, res: Response): Promise<void> {
  if (!req.file) { res.status(400).json({ success: false, message: 'CSV file required.' }); return; }
  const result = await adminService.bulkIngestTimetable(req.file.buffer);
  res.json({ success: true, message: `Ingested ${result.inserted} timetable slots.`, data: result });
}

// ── Batch Progression ────────────────────────────────────────

export async function triggerBatchProgression(req: Request, res: Response): Promise<void> {
  const result = await adminService.triggerBatchProgression();
  res.json({ success: true, message: 'Batch progression triggered.', data: result });
}

// ── Exam Seating ─────────────────────────────────────────────

export async function generateExamSeating(req: Request, res: Response): Promise<void> {
  const { classrooms } = req.body;
  if (!Array.isArray(classrooms) || !classrooms.length) {
    res.status(400).json({ success: false, message: 'classrooms array is required.' });
    return;
  }
  const seating = await adminService.generateExamSeating(classrooms);
  res.json({ success: true, data: seating });
}

// ── Invigilation ─────────────────────────────────────────────

export async function generateInvigilationMatrix(req: Request, res: Response): Promise<void> {
  const { exam_date } = req.body;
  if (!exam_date) {
    res.status(400).json({ success: false, message: 'exam_date is required.' });
    return;
  }
  const matrix = await adminService.generateInvigilationMatrix(exam_date);
  res.json({ success: true, data: matrix });
}

// ── Analytics ────────────────────────────────────────────────

export async function getMacroAnalytics(req: Request, res: Response): Promise<void> {
  const analytics = await adminService.getMacroAnalytics();
  res.json({ success: true, data: analytics });
}

// ── Faculty & Student ────────────────────────────────────────

export async function createFaculty(req: Request, res: Response): Promise<void> {
  const { name, email_id, designation_role, is_admin, is_hod, password } = req.body;
  if (!name || !email_id || !designation_role || !password) {
    res.status(400).json({ success: false, message: 'name, email_id, designation_role, password are required.' });
    return;
  }
  const id = await adminService.createFaculty({ name, email_id, designation_role, is_admin, is_hod, password });
  res.status(201).json({ success: true, message: 'Faculty created.', data: { faculty_id: id } });
}

export async function listFaculty(req: Request, res: Response): Promise<void> {
  const data = await adminService.listAllFaculty();
  res.json({ success: true, data });
}

export async function listStudents(req: Request, res: Response): Promise<void> {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 50;
  const data = await adminService.listAllStudents(page, limit);
  res.json({ success: true, data });
}

export async function getAlumni(req: Request, res: Response): Promise<void> {
  const data = await adminService.getAlumniRecords();
  res.json({ success: true, data });
}

// ── Notice Board ─────────────────────────────────────────────

export async function createNotice(req: Request, res: Response): Promise<void> {
  const { title, target_audience, ai_filter_tags } = req.body;
  if (!title || !target_audience) {
    res.status(400).json({ success: false, message: 'title and target_audience are required.' });
    return;
  }
  const id = await adminService.createNotice({ title, target_audience, ai_filter_tags });
  res.status(201).json({ success: true, message: 'Notice created.', data: { notice_id: id } });
}

export async function createAINotice(req: Request, res: Response): Promise<void> {
  const { context, target_audience } = req.body;
  if (!context) {
    res.status(400).json({ success: false, message: 'context is required for AI notice generation.' });
    return;
  }
  const noticeData = await geminiService.generateInstitutionalNotice(context);
  const id = await adminService.createNotice({
    title: noticeData.title,
    target_audience: target_audience || 'INSTITUTE',
    ai_filter_tags: noticeData.tags,
  });
  res.status(201).json({ success: true, message: 'AI notice generated and saved.', data: { notice_id: id, ...noticeData } });
}

export async function listNotices(req: Request, res: Response): Promise<void> {
  const audience = req.query.audience as string | undefined;
  const data = await adminService.listNotices(audience);
  res.json({ success: true, data });
}
