import { Request, Response, Router } from "express";
import { GapAnalysisService } from "../service/gapAnalysis.service";
import { BadRequestError } from "../errors/AppError";

const router = Router();
const gapAnalysisService = new GapAnalysisService();

router.post("/", async (req: Request, res: Response) => {
  const { applicationId, force } = req.body;
  if (!applicationId) throw new BadRequestError("applicationId is required");

  // JD content and the requirements/description presence check both live in
  // the service now, since they're read from the saved Application, not the request body.
  const result = await gapAnalysisService.analyze(req.user!.id, applicationId, Boolean(force));

  res.status(200).json(result);
});

export default router;
