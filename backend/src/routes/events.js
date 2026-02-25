import { Router } from 'express';
import { 
  getEvents, 
  getEventById, 
  createEvent, 
  updateEvent, 
  deleteEvent 
} from '../controllers/events.js';
import { authenticate, requireKavatender } from '../middleware/auth.js';

const router = Router();

// Public routes
router.get('/', getEvents);
router.get('/:id', getEventById);

// Protected routes
router.post('/', authenticate, requireKavatender, createEvent);
router.put('/:id', authenticate, requireKavatender, updateEvent);
router.delete('/:id', authenticate, requireKavatender, deleteEvent);

export default router;
