import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import * as ciCtrl from '../controllers/classIncharge.controller';

const router = Router();
router.use(authenticate, authorize('ClassIncharge', 'HOD', 'Admin'));

router.get('/analytics', ciCtrl.getClassAnalytics);
router.get('/students/at-risk', ciCtrl.getAtRiskStudents);
router.get('/students/:uid/portfolio', ciCtrl.getStudentPortfolio);
router.get('/students/:uid/ptm-report', ciCtrl.generatePTMReport);
router.get('/students', ciCtrl.getAllStudents);
router.get('/progression-readiness', ciCtrl.getProgressionReadiness);
router.get('/notices', ciCtrl.getNotices);
router.post('/notices', ciCtrl.createNotice);

export default router;
