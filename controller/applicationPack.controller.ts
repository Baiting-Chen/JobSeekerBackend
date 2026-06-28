import { Request, Response, Router } from "express";
import { ApplicationPackService } from "../service/applicationPack.service";
import { BadRequestError } from "../errors/AppError";

const router = Router();
const applicationPackService = new ApplicationPackService();

router.post("/", async (req: Request, res: Response) => {
  const { applicationId, forceGapAnalysis, forceCoverLetter, forceInterviewPrep, forceResumeImprovement } = req.body;
  if (!applicationId) throw new BadRequestError("applicationId is required");

  const result = await applicationPackService.generatePack(req.user!.id, applicationId, {
    gapAnalysis: Boolean(forceGapAnalysis),
    coverLetter: Boolean(forceCoverLetter),
    interviewPrep: Boolean(forceInterviewPrep),
    resumeImprovement: Boolean(forceResumeImprovement),
  });
  res.status(200).json(result);
});

export default router;
