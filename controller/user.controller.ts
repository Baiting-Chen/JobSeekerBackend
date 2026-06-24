import { Request, Response, Router } from "express";
import { UserService } from "../service/user.service";
import { ResumeService } from "../service/resume.service";
import { uploadResume } from "../middleware/upload";
import { BadRequestError } from "../errors/AppError";

const router = Router();
const userService = new UserService();
const resumeService = new ResumeService();

router.get("/me", async (req: Request, res: Response) => {
  const profile = await userService.getProfile(req.user!.id);
  res.status(200).json(profile);
});

router.patch("/me", async (req: Request, res: Response) => {
  const { firstName, lastName, targetRole, location, linkedIn } = req.body;
  const profile = await userService.updateProfile(req.user!.id, {
    firstName,
    lastName,
    targetRole,
    location,
    linkedIn,
  });
  res.status(200).json(profile);
});

router.post("/me/resume", (req: Request, res: Response, next) => {
  uploadResume(req, res, async (err) => {
    if (err) return next(err);
    if (!req.file) return next(new BadRequestError("No file uploaded"));
    try {
      const result = await resumeService.uploadResume(req.user!.id, req.file);
      res.status(200).json(result);
    } catch (e) {
      next(e);
    }
  });
});

router.get("/me/resume", async (req: Request, res: Response) => {
  const resume = await resumeService.getResume(req.user!.id);
  res.status(200).json(resume);
});

export default router;
