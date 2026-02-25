import { Router } from 'express';
import { 
  createCheckin, 
  getMyCheckins, 
  validateCheckin,
  getCheckinStats 
} from '../controllers/checkins.js';
import { authenticate, requireKavatender } from '../middleware/auth.js';

const router = Router();

// Protected routes
router.post('/', authenticate, createCheckin);
router.get('/me', authenticate, getMyCheckins);
router.get('/stats', authenticate, getCheckinStats);

// Kavatender validation
router.post('/:id/validate', authenticate, requireKavatender, validateCheckin);

export default router;
