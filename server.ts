import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRouter from "./controller/auth.controller";
import jobExtractorRouter from "./controller/jobExtractor.controller";
import userRouter from "./controller/user.controller";
import applicationRouter from "./controller/application.controller";
import gapAnalysisRouter from "./controller/gapAnalysis.controller";
import coverLetterRouter from "./controller/coverLetter.controller";
import interviewPrepRouter from "./controller/interviewPrep.controller";
import { errorHandler } from "./middleware/errorHandler";
import { requireAuth } from "./middleware/auth";

const app = express();
const port = 3001;

app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/jobs", requireAuth, jobExtractorRouter);
app.use("/api/v1/users", requireAuth, userRouter);
app.use("/api/v1/applications", requireAuth, applicationRouter);
app.use("/api/v1/gap-analysis", requireAuth, gapAnalysisRouter);
app.use("/api/v1/cover-letter", requireAuth, coverLetterRouter);
app.use("/api/v1/interview-prep", requireAuth, interviewPrepRouter);

// Must be registered after all routes
app.use(errorHandler);

app.listen(port, () => {
  console.log(`App is running on port ${port}`);
});
