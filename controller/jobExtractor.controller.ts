import { Request, Response, Router } from "express";
import { JobExtractorService } from "../service/jobExtractor.service";
import { BadRequestError } from "../errors/AppError";

const router = Router();

const jobExtractorService = new JobExtractorService();

router.post("/description", async (req: Request, res: Response) => {
  const { url } = req.body as { url?: string };

  if (!url) {
    throw new BadRequestError("url is required");
  }

  const jobDetails = await jobExtractorService.extractFromUrl(url);
  res.status(200).json(jobDetails);
});

export default router;
