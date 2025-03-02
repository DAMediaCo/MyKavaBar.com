import { Router } from 'express';
import { db } from '@db';
import { reviews, users, type Review } from '@db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

// Middleware to check if user is authenticated
function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'You must be logged in to perform this action' });
  }
  next();
}

// Get reviews for a specific bar
router.get('/api/reviews/:barId', async (req, res) => {
  try {
    const barId = parseInt(req.params.barId);
    if (isNaN(barId)) {
      return res.status(400).json({ message: 'Invalid bar ID' });
    }

    const reviewsList = await db.query.reviews.findMany({
      where: eq(reviews.barId, barId),
      with: {
        user: true,
      },
      orderBy: desc(reviews.createdAt),
    });

    res.json(reviewsList);
  } catch (error: any) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch reviews' });
  }
});

// Create a new review
const createReviewSchema = z.object({
  barId: z.number(),
  rating: z.number().min(1).max(5),
  content: z.string().min(1, 'Review content is required'),
});

router.post('/api/reviews', requireAuth, async (req: Express.Request, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'You must be logged in to perform this action' });
    }

    const result = createReviewSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        message: 'Invalid review data',
        errors: result.error.issues 
      });
    }

    // Check if user already reviewed this bar
    const existingReview = await db.query.reviews.findFirst({
      where: and(
        eq(reviews.userId, req.user.id),
        eq(reviews.barId, result.data.barId)
      ),
    });

    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this bar' });
    }

    const [review] = await db.insert(reviews)
      .values({
        ...result.data,
        userId: req.user.id,
      })
      .returning();

    res.status(201).json(review);
  } catch (error: any) {
    console.error('Error creating review:', error);
    res.status(500).json({ message: error.message || 'Failed to create review' });
  }
});

// Update a review
router.put('/api/reviews/:id', requireAuth, async (req: Express.Request, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'You must be logged in to perform this action' });
    }

    const reviewId = parseInt(req.params.id);
    if (isNaN(reviewId)) {
      return res.status(400).json({ message: 'Invalid review ID' });
    }

    const result = createReviewSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        message: 'Invalid review data',
        errors: result.error.issues 
      });
    }

    // Check if review exists and belongs to user
    const existingReview = await db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
    });

    if (!existingReview) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (existingReview.userId !== req.user.id) {
      return res.status(403).json({ message: 'You can only edit your own reviews' });
    }

    const [updatedReview] = await db.update(reviews)
      .set(result.data)
      .where(eq(reviews.id, reviewId))
      .returning();

    res.json(updatedReview);
  } catch (error: any) {
    console.error('Error updating review:', error);
    res.status(500).json({ message: error.message || 'Failed to update review' });
  }
});

// Delete a review
router.delete('/api/reviews/:id', requireAuth, async (req: Express.Request, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'You must be logged in to perform this action' });
    }

    const reviewId = parseInt(req.params.id);
    if (isNaN(reviewId)) {
      return res.status(400).json({ message: 'Invalid review ID' });
    }

    // Check if review exists and belongs to user
    const existingReview = await db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
    });

    if (!existingReview) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (existingReview.userId !== req.user.id) {
      return res.status(403).json({ message: 'You can only delete your own reviews' });
    }

    await db.delete(reviews)
      .where(eq(reviews.id, reviewId));

    res.json({ message: 'Review deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting review:', error);
    res.status(500).json({ message: error.message || 'Failed to delete review' });
  }
});

export default router;