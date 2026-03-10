import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@db";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";

export async function isAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // 1. Session auth (web)
  if (req.isAuthenticated()) return next();

  // 2. JWT Bearer token (mobile)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const secret = process.env.JWT_SECRET || "fallback-secret";
      const decoded = jwt.verify(token, secret) as { userId: number };
      const user = await db.query.users.findFirst({
        where: eq(users.id, decoded.userId),
      });
      if (user) {
        req.user = user as Express.User;
        return next();
      }
    } catch {
      // invalid/expired token — fall through to 401
    }
  }

  return res.status(401).json({ message: "Authentication required" });
}

export function isPhoneVerifiedMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.user && !req.user?.isPhoneVerified && req.user.provider !== "local") {
    return res.status(401).json({ message: "Phone number not verified" });
  }
  next();
}
