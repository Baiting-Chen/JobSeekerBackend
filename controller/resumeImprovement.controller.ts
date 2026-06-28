import { Request, Response, Router } from "express";
import { ResumeImprovementService } from "../service/resumeImprovement.service";
import { BadRequestError } from "../errors/AppError";

const router = Router();
const resumeImprovementService = new ResumeImprovementService();

router.post("/", async (req: Request, res: Response) => {
  const { applicationId, force } = req.body;
  if (!applicationId) throw new BadRequestError("applicationId is required");

  const result = await resumeImprovementService.generate(req.user!.id, applicationId, Boolean(force));
  res.status(200).json(result);
});

export default router;
