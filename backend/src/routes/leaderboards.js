import { Router } from 'express';
import { getLeaderboards } from '../controllers/leaderboards.js';

const router = Router();

router.get('/', getLeaderboards);

export default router;
