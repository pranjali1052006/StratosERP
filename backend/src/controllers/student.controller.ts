import { Request, Response } from 'express';
import * as studentService from '../services/student.service';
import * as geminiService from '../services/gemini.service';
import * as minioService from '../services/minio.service';

export async function getDashboard(req: Request, res: Response): Promise<void> {
  const uid = req.user!.id as string;
  const data = await studentService.getStudentDashboard(uid);
  if (!data) { res.status(404).json({ success: false, message: 'Student not found.' }); return; }
  res.json({ success: true, data });
}

export async function getTimetable(req: Request, res: Response): Promise<void> {
  const uid = req.user!.id as string;
  const data = await studentService.getTimetable(uid);
  res.json({ success: true, data });
}

export async function liveFacultyLocator(req: Request, res: Response): Promise<void> {
  const data = await studentService.liveFacultyLocator();
  res.json({ success: true, data });
}

export async function submitGrievance(req: Request, res: Response): Promise<void> {
  const { category, description, evidence } = req.body;
  const uid = req.user!.id as string;
  if (!category || !description) {
    res.status(400).json({ success: false, message: 'category and description required.' });
    return;
  }
  // Route via Gemini AI
  const routing = await geminiService.routeGrievance(category, description);
  const ticketId = await studentService.submitGrievance({ student_uid: uid, category, description, evidence });

  // Update with AI-assigned authority if resolved
  res.status(201).json({
    success: true,
    message: 'Grievance submitted.',
    data: { ticket_id: ticketId, ai_routing: routing },
  });
}

export async function getMyGrievances(req: Request, res: Response): Promise<void> {
  const uid = req.user!.id as string;
  const data = await studentService.getMyGrievances(uid);
  res.json({ success: true, data });
}

export async function getNotices(req: Request, res: Response): Promise<void> {
  const data = await studentService.getNotices();
  res.json({ success: true, data });
}

export async function getMaterials(req: Request, res: Response): Promise<void> {
  const { subject_id } = req.params;
  const data = await studentService.getStudyMaterials(Number(subject_id));
  res.json({ success: true, data });
}

export async function downloadMaterial(req: Request, res: Response): Promise<void> {
  const { object_name } = req.query;
  if (!object_name) {
    res.status(400).json({ success: false, message: 'object_name required.' });
    return;
  }
  try {
    const url = await minioService.getPresignedDownloadUrl(object_name as string, 'study-materials');
    res.json({ success: true, data: { download_url: url } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'File storage service unavailable.';
    res.status(503).json({ success: false, message });
  }
}

export async function getLabMarks(req: Request, res: Response): Promise<void> {
  const uid = req.user!.id as string;
  const data = await studentService.getLabMarks(uid);
  res.json({ success: true, data });
}
