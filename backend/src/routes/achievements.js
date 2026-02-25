import { Router } from 'express';
import { 
  getAchievements, 
  getMyAchievements,
  createAchievement 
} from '../controllers/achievements.js';
import { authenticate, optionalAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Public route - all achievements with user progress
router.get('/', optionalAuth, getAchievements);
// Protected routes
router.get('/me', authenticate, getMyAchievements);

// Admin routes
router.post('/', authenticate, requireAdmin, createAchievement);

export default router;
