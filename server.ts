import express from "express";
import cors from "cors";
import jobExtractorRouter from "./controller/jobExtractor.controller";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use("/api/v1/jobs", jobExtractorRouter);

// Must be registered after all routes
app.use(errorHandler);

app.listen(port, () => {
  console.log(`App is running on port ${port}`);
});
