import { Request, Response, Router } from "express";
import { ApplicationService } from "../service/application.service";
import { BadRequestError } from "../errors/AppError";

const router = Router();
const applicationService = new ApplicationService();

function getApplicationId(req: Request): string {
  const { id } = req.params;

  if (typeof id !== "string" || !id.trim()) {
    throw new BadRequestError("application id is required");
  }

  return id;
}

router.post("/", async (req: Request, res: Response) => {
  const {
    url,
    company,
    companyDescription,
    position,
    requirements,
    description,
    location,
    salary,
  } = req.body;

  if (!url) throw new BadRequestError("url is required");

  const application = await applicationService.create(req.user!.id, {
    url,
    company,
    companyDescription,
    position,
    requirements,
    description,
    location,
    salary,
  });

  res.status(201).json(application);
});

router.get("/", async (req: Request, res: Response) => {
  const applications = await applicationService.list(req.user!.id);
  res.status(200).json(applications);
});

router.get("/:id", async (req: Request, res: Response) => {
  const applicationId = getApplicationId(req);

  const application = await applicationService.getById(
    req.user!.id,
    applicationId,
  );

  res.status(200).json(application);
});

router.patch("/:id", async (req: Request, res: Response) => {
  const applicationId = getApplicationId(req);

  const {
    company,
    companyDescription,
    position,
    requirements,
    description,
    location,
    salary,
    status,
  } = req.body;

  const application = await applicationService.update(
    req.user!.id,
    applicationId,
    {
      company,
      companyDescription,
      position,
      requirements,
      description,
      location,
      salary,
      status,
    },
  );

  res.status(200).json(application);
});

router.delete("/:id", async (req: Request, res: Response) => {
  const applicationId = getApplicationId(req);

  await applicationService.delete(req.user!.id, applicationId);

  res.status(204).send();
});

export default router;
