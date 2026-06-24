import { z } from "zod";
import { Runnable } from "@langchain/core/runnables";
import { chromium, Browser } from "playwright";
import { BadRequestError, ValidationError, ServiceUnavailableError } from "../errors/AppError";
import { openaiJobExtractor } from "../lib/llm";

/**
 * 1. Define the Job Schema and the type of the JobDetails
 */
const JobSchema = z.object({
  isJob: z.boolean().describe("Whether this Url is a job info url"),
  company: z.string().nullable().describe("The name of the company"),
  position: z.string().nullable().describe("Job title or role name"),
  requirements: z
    .string()
    .nullable()
    .describe("Job requirements for candidate"),
  description: z.string().nullable().describe("Main job responsibilities"),
  location: z.string().nullable().describe("Office location or 'Remote'"),
  salary: z.string().nullable().describe("Payment Range"),
  companyDescription: z
    .string()
    .nullable()
    .describe("Short summary of what the company does, only if an About Us / company intro section is present on the page. Null if not present."),
});

type JobDetails = z.infer<typeof JobSchema>;

/**
 * 2. JobExtractorService class implementation
 */
export class JobExtractorService {
  private structuredLlm: Runnable<any, JobDetails>;
  private browser: Browser | null = null;

  constructor() {
    //Use the preset llm model to output the zod schema
    this.structuredLlm = openaiJobExtractor.withStructuredOutput(JobSchema);
  }

  /**
   * make the function public
   * for Controller to invoke
   * input url and extract the jobdetails as output
   */
  public async extractFromUrl(url: string): Promise<JobDetails> {
    // Validate URL format before doing anything
    try {
      new URL(url);
    } catch {
      throw new BadRequestError("Invalid URL format.");
    }

    let jobDetails: JobDetails;
    try {
      const pageContent = await this.scrapePageContent(url);
      jobDetails = await this.extractJD(url, pageContent);
    } catch (error) {
      console.error("Extraction Service Error:", error);
      const status = (error as any)?.status;
      if (status === 503 || status === 429) {
        throw new ServiceUnavailableError();
      }
      throw new Error(
        `Failed to extract job information: ${(error as Error).message}`,
      );
    }

    // Handle non-job pages outside the try-catch so the message stays clean
    if (!jobDetails.isJob) {
      throw new ValidationError(
        "The provided URL does not appear to be a job posting.",
      );
    }

    return jobDetails;
  }

  //Lazy browser singleton — reuse across requests instead of launching per call
  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await chromium.launch({ headless: true });
    }
    return this.browser;
  }

  private async scrapePageContent(url: string): Promise<string> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.goto(url, {
        waitUntil: "load",
        timeout: 30000,
      });

      await page
        .waitForLoadState("networkidle", { timeout: 10000 })
        .catch(() => {});

      const cleanText = (await page.locator("body").innerText())
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 15000);

      return cleanText;
    } catch (error) {
      console.error("Scraper Error:", error);
      // 6. Re-throw with original message preserved
      throw new Error(
        `Failed to scrape webpage content: ${(error as Error).message}`,
      );
    } finally {
      // Close the page only, keep browser alive for next request
      await page.close();
    }
  }

  /**
   * Private function:Use AI to extract JD
   */
  private async extractJD(
    url: string,
    pageContent: string,
  ): Promise<JobDetails> {
    const prompt = `
    You are a job posting extraction assistant.
    Your task is to extract job information from the webpage content below.
    Return the result according to the required schema.
    Rules:
      - If the webpage is a job posting, set isJob to true.
      - If the webpage is not a job posting, set isJob to false.
      - If isJob is false, set company, position, requirements, description, location, salary, and companyDescription to null.
      - Do not invent missing information.
      - If a field is not clearly provided, set it to null.
      - Salary can include hourly, yearly, monthly, or range information.
      - Location can be a city, country, hybrid, onsite, or remote.
      - Requirements should include candidate qualifications, skills, experience, education, or technology requirements.
      - Description should include the main responsibilities or duties of the role.
      - Keep requirements and description concise but complete.
      - companyDescription should only be filled in if the page itself has an "About Us" / company intro section describing what the company does. Do not infer it from the job title or guess based on the company name — leave it null if the page doesn't say.
    URL:
    ${url}
    Webpage content:
    ${pageContent}
    `;

    const result = await this.structuredLlm.invoke(prompt);
    return result;
  }
}
