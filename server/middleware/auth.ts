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
