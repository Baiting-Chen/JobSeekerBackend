import { Request, Response, Router } from "express";
import { CoverLetterService } from "../service/coverLetter.service";
import { BadRequestError } from "../errors/AppError";

const router = Router();
const coverLetterService = new CoverLetterService();

router.post("/", async (req: Request, res: Response) => {
  const { applicationId, force } = req.body;
  if (!applicationId) throw new BadRequestError("applicationId is required");

  const result = await coverLetterService.generate(req.user!.id, applicationId, Boolean(force));
  res.status(200).json(result);
});

export default router;
