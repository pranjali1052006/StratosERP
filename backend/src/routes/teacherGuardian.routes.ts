import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import * as tgCtrl from '../controllers/teacherGuardian.controller';

const router = Router();
router.use(authenticate, authorize('TG', 'ClassIncharge', 'HOD', 'Admin'));

// Mentee Management
router.get('/mentees', tgCtrl.getMentees);
router.get('/mentees/:uid', tgCtrl.getMenteePortfolio);
router.get('/mentees/:uid/improvement-report', tgCtrl.generateImprovementReport);

// AICTE Points
router.post('/aicte-points', tgCtrl.awardAICTEPoints);
router.get('/aicte-points/:uid', tgCtrl.getAICTEPoints);

// Grievances
router.get('/grievances', tgCtrl.getGrievances);
router.put('/grievances/:ticket_id/resolve', tgCtrl.resolveGrievance);

// Notices
router.get('/notices', tgCtrl.getNotices);

export default router;
