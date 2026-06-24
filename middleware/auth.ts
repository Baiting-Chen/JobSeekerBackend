import { Request, Response, NextFunction } from "express";
import { AuthService } from "../service/auth.service";
import { UnauthorizedError } from "../errors/AppError";

const authService = new AuthService();

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return next(new UnauthorizedError());
  }

  try {
    const token = authHeader.split(" ")[1];
    if (!token) {
      return next(new UnauthorizedError());
    }
    const payload = authService.verifyAccessToken(token);
    req.user = { id: payload.userId };
    next();
  } catch (err) {
    next(err);
  }
}
