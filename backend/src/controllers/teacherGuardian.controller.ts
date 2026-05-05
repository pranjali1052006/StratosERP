import { Request, Response } from 'express';
import * as tgService from '../services/teacherGuardian.service';
import * as geminiService from '../services/gemini.service';

export async function getMentees(req: Request, res: Response): Promise<void> {
  const facultyId = req.user!.id as number;
  const data = await tgService.getMentees(facultyId);
  res.json({ success: true, data });
}

export async function getMenteePortfolio(req: Request, res: Response): Promise<void> {
  const { uid } = req.params;
  const facultyId = req.user!.id as number;
  const data = await tgService.getMenteePortfolio(facultyId, uid);
  res.json({ success: true, data });
}

export async function awardAICTEPoints(req: Request, res: Response): Promise<void> {
  const { student_uid, activity, points } = req.body;
  const facultyId = req.user!.id as number;
  if (!student_uid || !activity || !points) {
    res.status(400).json({ success: false, message: 'student_uid, activity, points required.' });
    return;
  }
  const id = await tgService.awardAICTEPoints({ student_uid, activity, points, faculty_id: facultyId });
  res.status(201).json({ success: true, message: 'AICTE points awarded.', data: { record_id: id } });
}

export async function getAICTEPoints(req: Request, res: Response): Promise<void> {
  const { uid } = req.params;
  const data = await tgService.getAICTEPoints(uid);
  res.json({ success: true, data });
}

export async function getGrievances(req: Request, res: Response): Promise<void> {
  const facultyId = req.user!.id as number;
  const data = await tgService.getAssignedGrievances(facultyId);
  res.json({ success: true, data });
}

export async function resolveGrievance(req: Request, res: Response): Promise<void> {
  const { ticket_id } = req.params;
  const facultyId = req.user!.id as number;
  await tgService.resolveGrievance(Number(ticket_id), facultyId);
  res.json({ success: true, message: 'Grievance resolved.' });
}

export async function generateImprovementReport(req: Request, res: Response): Promise<void> {
  const { uid } = req.params;
  const facultyId = req.user!.id as number;
  const portfolio = await tgService.getMenteePortfolio(facultyId, uid);
  const report = await geminiService.generateAreasOfImprovement(portfolio);
  res.json({ success: true, data: { uid, report } });
}

export async function getNotices(req: Request, res: Response): Promise<void> {
  const data = await tgService.getRelevantNotices();
  res.json({ success: true, data });
}
