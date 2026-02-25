import { Router } from 'express';
import { 
  getMissions, 
  getMissionHistory, 
  claimMission,
  createMission
} from '../controllers/missions.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Protected routes
router.get('/', authenticate, getMissions);
router.get('/history', authenticate, getMissionHistory);
router.post('/:id/claim', authenticate, claimMission);

// Admin routes
router.post('/', authenticate, requireAdmin, createMission);

export default router;
