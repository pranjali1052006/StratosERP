import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import * as adminCtrl from '../controllers/admin.controller';

const router = Router();
router.use(authenticate, authorize('Admin'));

// Global Config
router.get('/config', adminCtrl.getGlobalConfig);
router.post('/config', adminCtrl.setGlobalConfig);

// Bulk CSV Ingestion
router.post('/ingest/students', adminCtrl.csvUpload, adminCtrl.ingestStudents);
router.post('/ingest/faculty', adminCtrl.csvUpload, adminCtrl.ingestFaculty);
router.post('/ingest/subjects', adminCtrl.csvUpload, adminCtrl.ingestSubjects);
router.post('/ingest/timetable', adminCtrl.csvUpload, adminCtrl.ingestTimetable);

// Batch Progression
router.post('/batch-progression', adminCtrl.triggerBatchProgression);
router.get('/batch-progression/status', adminCtrl.getBatchProgressionStatus);
router.post('/batch-progression/promote-year', adminCtrl.promoteAcademicYear);

// Exam & Invigilation
router.post('/exam-seating', adminCtrl.generateExamSeating);
router.post('/invigilation-matrix', adminCtrl.generateInvigilationMatrix);

// Analytics
router.get('/analytics', adminCtrl.getMacroAnalytics);

// Faculty Management
router.post('/faculty', adminCtrl.createFaculty);
router.get('/faculty', adminCtrl.listFaculty);

// Student Management
router.get('/students', adminCtrl.listStudents);
router.get('/alumni', adminCtrl.getAlumni);

// Notice Board
router.post('/notices', adminCtrl.createNotice);
router.post('/notices/ai', adminCtrl.createAINotice);
router.get('/notices', adminCtrl.listNotices);

export default router;
