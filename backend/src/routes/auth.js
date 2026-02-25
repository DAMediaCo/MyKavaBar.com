import { Router } from 'express';
import { register, login, getMe, refreshToken, updateProfile } from '../controllers/auth.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Auth routes
router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, getMe);
router.post('/refresh', authenticate, refreshToken);
router.put('/me', authenticate, updateProfile);

export default router;
