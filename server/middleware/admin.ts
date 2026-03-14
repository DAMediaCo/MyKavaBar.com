import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@db";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";

/**
 * requireAdmin — supports both session auth (web) and Bearer JWT (mobile)
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // 1. Session auth (web)
  if (req.isAuthenticated()) {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }
    return next();
  }

  // 2. Bearer token auth (mobile)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const secret = process.env.JWT_SECRET || "fallback-secret";
      const decoded = jwt.verify(token, secret) as { userId: number };
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, decoded.userId))
        .limit(1);
      if (!user) return res.status(401).json({ error: "Not authenticated" });
      if (!user.isAdmin) return res.status(403).json({ error: "Admin access required" });
      req.user = user as Express.User;
      return next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  }

  return res.status(401).json({ error: "Not authenticated" });
}
