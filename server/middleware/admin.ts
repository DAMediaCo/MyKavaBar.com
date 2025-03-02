import { Request, Response, NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  console.log('Checking admin access:', {
    isAuthenticated: req.isAuthenticated(),
    user: req.user ? {
      id: req.user.id,
      isAdmin: req.user.isAdmin,
      username: req.user.username
    } : null,
    session: req.session ? {
      id: req.session.id,
      cookie: req.session.cookie
    } : null,
    headers: {
      cookie: req.headers.cookie,
      authorization: req.headers.authorization
    }
  });

  if (!req.isAuthenticated()) {
    console.log('Admin access denied: Not authenticated');
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!req.user?.isAdmin) {
    console.log('Admin access denied: User is not an admin');
    return res.status(403).json({ error: "Admin access required" });
  }

  console.log('Admin access granted for user:', req.user.username);
  next();
}