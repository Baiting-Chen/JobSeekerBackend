import { BadRequestError } from "../errors/AppError";
import { AuthService } from "../service/auth.service";
import { Request, Response, Router } from "express";

const router = Router();
const authService = new AuthService();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

router.post("/register", async (req: Request, res: Response) => {
  const { email, password, firstName, lastName, targetRole, location, linkedIn } =
    req.body;
  if (!email || !password || !firstName || !lastName)
    throw new BadRequestError(
      "Email, password, firstName, and lastName are required",
    );
  if (password.length < 8) {
    throw new BadRequestError("Password must be at least 8 characters");
  }

  const { accessToken, refreshToken } = await authService.register({
    email,
    password,
    firstName,
    lastName,
    targetRole,
    location,
    linkedIn,
  });
  res.cookie("refreshToken", refreshToken, COOKIE_OPTIONS);
  res.status(201).json({ accessToken });
});

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password)
    throw new BadRequestError("Email and password required");
  const { accessToken, refreshToken } = await authService.login(
    email,
    password,
  );
  res.cookie("refreshToken", refreshToken, COOKIE_OPTIONS);
  res.status(200).json({ accessToken });
});

router.post("/refresh", async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (!token) throw new BadRequestError("No refresh token");
  const { accessToken, refreshToken } = await authService.refresh(token);
  res.cookie("refreshToken", refreshToken, COOKIE_OPTIONS);
  res.status(200).json({ accessToken });
});

router.post("/logout", async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (token) await authService.logout(token);
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
  });
  res.status(200).json({ message: "Logged out" });
});

export default router;
