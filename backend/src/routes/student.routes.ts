import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import * as studentCtrl from '../controllers/student.controller';

const router = Router();
router.use(authenticate, authorize('Student'));

// Dashboard
router.get('/dashboard', studentCtrl.getDashboard);

// Timetable & Faculty Locator
router.get('/timetable', studentCtrl.getTimetable);
router.get('/faculty-locator', studentCtrl.liveFacultyLocator);

// Grievances
router.post('/grievances', studentCtrl.submitGrievance);
router.get('/grievances', studentCtrl.getMyGrievances);

// Notices
router.get('/notices', studentCtrl.getNotices);

// Study Materials
router.get('/materials/:subject_id', studentCtrl.getMaterials);
router.get('/materials/download', studentCtrl.downloadMaterial);

// Lab Marks
router.get('/lab-marks', studentCtrl.getLabMarks);

export default router;
