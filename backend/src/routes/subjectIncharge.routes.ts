import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import * as siCtrl from '../controllers/subjectIncharge.controller';

const router = Router();
router.use(authenticate, authorize('SubjectIncharge', 'HOD', 'Admin'));

// Subjects
router.get('/subjects', siCtrl.getMySubjects);

// Marks
router.post('/marks', siCtrl.upsertMarks);
router.post('/marks/suppli', siCtrl.upsertSuppliMarks);
router.get('/marks/:subject_id', siCtrl.getSubjectMarks);
router.get('/analytics/:subject_id', siCtrl.getSubjectAnalytics);

// Attendance
router.get('/slot/active', siCtrl.getActiveSlot);
router.post('/attendance', siCtrl.markAttendance);
router.get('/attendance/:slot_id', siCtrl.getAttendance);

// Lecture Logs
router.post('/lecture-log', siCtrl.logLecture);
router.get('/lecture-logs/:subject_id', siCtrl.getLectureLogs);

// Study Materials
router.post('/materials', siCtrl.fileUpload, siCtrl.uploadMaterial);

// AI Syllabus Analysis
router.post('/syllabus-analysis', siCtrl.syllabusAnalysis);

export default router;
