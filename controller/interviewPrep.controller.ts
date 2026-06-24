import { Request, Response, Router } from "express";
import { InterviewPrepService } from "../service/interviewPrep.service";
import { BadRequestError } from "../errors/AppError";

const router = Router();
const interviewPrepService = new InterviewPrepService();

router.post("/", async (req: Request, res: Response) => {
  const { applicationId } = req.body;
  if (!applicationId) throw new BadRequestError("applicationId is required");

  const result = await interviewPrepService.generate(req.user!.id, applicationId);
  res.status(200).json(result);
});

export default router;
