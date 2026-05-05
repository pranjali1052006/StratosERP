import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import * as hodCtrl from '../controllers/hod.controller';

const router = Router();
router.use(authenticate, authorize('HOD'));

// Faculty Management
router.get('/faculty', hodCtrl.getFaculty);
router.post('/faculty/assign-subject', hodCtrl.assignSubject);
router.post('/faculty/assign-role', hodCtrl.assignRole);

// Analytics
router.get('/analytics', hodCtrl.getBranchAnalytics);
router.get('/students/:uid', hodCtrl.trackStudent);
router.get('/alumni', hodCtrl.getAlumni);

// Grievances
router.get('/grievances/escalated', hodCtrl.getEscalatedGrievances);
router.put('/grievances/:ticket_id/resolve', hodCtrl.resolveGrievance);

// Leave Management
router.get('/leave', hodCtrl.getLeaveLog);
router.post('/leave', hodCtrl.scheduleLeave);

// Notices
router.get('/notices', hodCtrl.getNotices);
router.post('/notices', hodCtrl.createNotice);
router.post('/notices/ai', hodCtrl.createAINotice);

// Subjects
router.get('/subjects', hodCtrl.getSubjects);

export default router;
