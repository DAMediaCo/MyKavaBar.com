import { Router } from 'express';
import { 
  getFavorites, 
  addFavorite, 
  removeFavorite,
  checkFavorite 
} from '../controllers/favorites.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Protected routes
router.get('/', authenticate, getFavorites);
router.post('/', authenticate, addFavorite);
router.delete('/:barId', authenticate, removeFavorite);
router.get('/:barId/check', authenticate, checkFavorite);

export default router;
