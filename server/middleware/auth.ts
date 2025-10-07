import { Request, Response, NextFunction } from "express";

export function isAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  console.log("Checking authentication:", {
    isAuthenticated: req.isAuthenticated(),
    session: req.session ? { id: req.session.id } : null,
  });

  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
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
