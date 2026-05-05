import { Request, Response } from 'express';
import * as hodService from '../services/hod.service';
import * as geminiService from '../services/gemini.service';

export async function assignSubject(req: Request, res: Response): Promise<void> {
  const { subject_id, faculty_id } = req.body;
  if (!subject_id || !faculty_id) {
    res.status(400).json({ success: false, message: 'subject_id and faculty_id are required.' });
    return;
  }
  await hodService.assignSubjectToFaculty(Number(subject_id), Number(faculty_id));
  res.json({ success: true, message: 'Subject assigned to faculty.' });
}

export async function assignRole(req: Request, res: Response): Promise<void> {
  const { faculty_id, role } = req.body;
  if (!faculty_id || !role) {
    res.status(400).json({ success: false, message: 'faculty_id and role are required.' });
    return;
  }
  await hodService.assignFacultyRole(Number(faculty_id), role);
  res.json({ success: true, message: 'Role assigned.' });
}

export async function getFaculty(req: Request, res: Response): Promise<void> {
  const data = await hodService.listFacultyByDepartment();
  res.json({ success: true, data });
}

export async function getBranchAnalytics(req: Request, res: Response): Promise<void> {
  const data = await hodService.getBranchAnalytics();
  res.json({ success: true, data });
}

export async function trackStudent(req: Request, res: Response): Promise<void> {
  const { uid } = req.params;
  const data = await hodService.getStudentDashboard(uid);
  res.json({ success: true, data });
}

export async function getAlumni(req: Request, res: Response): Promise<void> {
  const data = await hodService.getAlumniData();
  res.json({ success: true, data });
}

export async function getEscalatedGrievances(req: Request, res: Response): Promise<void> {
  const data = await hodService.getEscalatedGrievances();
  res.json({ success: true, data });
}

export async function resolveGrievance(req: Request, res: Response): Promise<void> {
  const { ticket_id } = req.params;
  await hodService.resolveGrievance(Number(ticket_id));
  res.json({ success: true, message: 'Grievance resolved.' });
}

export async function getLeaveLog(req: Request, res: Response): Promise<void> {
  const data = await hodService.getLeaveSubstitutionLog();
  res.json({ success: true, data });
}

export async function scheduleLeave(req: Request, res: Response): Promise<void> {
  const { absent_faculty_id, substitute_faculty_id, leave_date, type } = req.body;
  if (!absent_faculty_id || !substitute_faculty_id || !leave_date || !type) {
    res.status(400).json({ success: false, message: 'All leave fields are required.' });
    return;
  }
  const id = await hodService.scheduleLeave({ absent_faculty_id, substitute_faculty_id, leave_date, type });
  res.status(201).json({ success: true, message: 'Leave scheduled.', data: { leave_id: id } });
}

export async function createNotice(req: Request, res: Response): Promise<void> {
  const { title, ai_filter_tags } = req.body;
  if (!title) {
    res.status(400).json({ success: false, message: 'title is required.' });
    return;
  }
  const id = await hodService.createBranchNotice(title, ai_filter_tags);
  res.status(201).json({ success: true, message: 'Notice created.', data: { notice_id: id } });
}

export async function createAINotice(req: Request, res: Response): Promise<void> {
  const { context } = req.body;
  if (!context) {
    res.status(400).json({ success: false, message: 'context is required.' });
    return;
  }
  const noticeData = await geminiService.generateInstitutionalNotice(context);
  const id = await hodService.createBranchNotice(noticeData.title, noticeData.tags);
  res.status(201).json({ success: true, data: { notice_id: id, ...noticeData } });
}

export async function getNotices(req: Request, res: Response): Promise<void> {
  const data = await hodService.getBranchNotices();
  res.json({ success: true, data });
}

export async function getSubjects(req: Request, res: Response): Promise<void> {
  const data = await hodService.getSubjectsList();
  res.json({ success: true, data });
}
