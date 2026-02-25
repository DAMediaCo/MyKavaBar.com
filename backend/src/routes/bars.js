import { Router } from 'express';
import { 
  getBars, 
  getBarById, 
  getBarEvents, 
  getBarMenu, 
  claimBar,
  createBar,
  updateBar
} from '../controllers/bars.js';
import { authenticate, optionalAuth, requireKavatender } from '../middleware/auth.js';

const router = Router();

// Public routes
router.get('/', optionalAuth, getBars);
router.get('/:id', optionalAuth, getBarById);
router.get('/:id/events', getBarEvents);
router.get('/:id/menu', getBarMenu);

// Protected routes
router.post('/', authenticate, requireKavatender, createBar);
router.put('/:id', authenticate, requireKavatender, updateBar);
router.post('/:id/claim', authenticate, claimBar);

export default router;
