import { Request, Response, Router } from "express";
import { CoverLetterService } from "../service/coverLetter.service";
import { CoverLetterCheckService } from "../service/coverLetterCheck.service";
import { BadRequestError } from "../errors/AppError";

const router = Router();
const coverLetterService = new CoverLetterService();
const coverLetterCheckService = new CoverLetterCheckService();

router.post("/", async (req: Request, res: Response) => {
  const { applicationId, force } = req.body;
  if (!applicationId) throw new BadRequestError("applicationId is required");

  const result = await coverLetterService.generate(req.user!.id, applicationId, Boolean(force));
  res.status(200).json(result);
});

// Test-only entry point: lets you run the checker against arbitrary cover letter
// text (e.g. a hand-written bad example) without going through generation first.
router.post("/check", async (req: Request, res: Response) => {
  const { applicationId, coverLetterContent } = req.body;
  if (!applicationId) throw new BadRequestError("applicationId is required");
  if (!coverLetterContent) throw new BadRequestError("coverLetterContent is required");

  const result = await coverLetterCheckService.checkForApplication(req.user!.id, applicationId, coverLetterContent);
  res.status(200).json(result);
});

export default router;
