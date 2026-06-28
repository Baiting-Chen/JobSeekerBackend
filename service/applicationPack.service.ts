import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { GapAnalysisService, GapAnalysisResult } from "./gapAnalysis.service";
import { CoverLetterService, CoverLetterResult } from "./coverLetter.service";
import {
  InterviewPrepService,
  InterviewPrepResult,
} from "./interviewPrep.service";
import {
  ResumeImprovementService,
  ResumeImprovementPlanResult,
} from "./resumeImprovement.service";

export type ApplicationPackRoute = "low_fit" | "good_fit";

export type ApplicationPackForceOptions = {
  gapAnalysis?: boolean;
  coverLetter?: boolean;
  interviewPrep?: boolean;
  resumeImprovement?: boolean;
};

export type ApplicationPackResult = {
  route: ApplicationPackRoute;
  gapAnalysis: GapAnalysisResult;
  resumeImprovementPlan: ResumeImprovementPlanResult | null;
  coverLetter: CoverLetterResult | null;
  interviewPrep: InterviewPrepResult | null;
};

// Below 55 overall match, or with several must-haves weak/missing, a cover letter
// would likely overstate the fit — steer to a resume improvement plan instead.
// Looks at the must-have ratio in addition to overallMatch so a low score driven
// purely by nice-to-haves doesn't wrongly route here, and vice versa.
function decideFitRoute(gapAnalysis: GapAnalysisResult): ApplicationPackRoute {
  const mustHaves = gapAnalysis.requiredSkills.filter(
    (s) => s.category === "must_have",
  );
  if (mustHaves.length === 0) {
    return gapAnalysis.overallMatch < 75 ? "low_fit" : "good_fit";
  }

  const missingMustHaves = mustHaves.filter(
    (s) => s.matchLevel === "missing",
  ).length;
  const weakOrMissingRatio =
    mustHaves.filter((s) => s.matchLevel !== "strong").length /
    mustHaves.length;

  if (gapAnalysis.overallMatch < 75) return "low_fit";
  if (missingMustHaves >= 3) return "low_fit";
  if (weakOrMissingRatio >= 0.6) return "low_fit";
  return "good_fit";
}

const ApplicationPackState = Annotation.Root({
  userId: Annotation<string>,
  applicationId: Annotation<string>,
  force: Annotation<ApplicationPackForceOptions>,
  gapAnalysis: Annotation<GapAnalysisResult | undefined>,
  route: Annotation<ApplicationPackRoute | undefined>,
  resumeImprovementPlan: Annotation<ResumeImprovementPlanResult | undefined>,
  coverLetter: Annotation<CoverLetterResult | undefined>,
  interviewPrep: Annotation<InterviewPrepResult | undefined>,
});

type PackState = typeof ApplicationPackState.State;

// Service classes still own their own prompts, schemas, and caching — this graph
// only decides which services to call and in what order/branch. See the
// "Application Assistant Orchestration Strategy" design notes for the full rationale.
export class ApplicationPackService {
  private gapAnalysisService = new GapAnalysisService();
  private coverLetterService = new CoverLetterService();
  private interviewPrepService = new InterviewPrepService();
  private resumeImprovementService = new ResumeImprovementService();
  private graph: ReturnType<typeof this.buildGraph>;

  constructor() {
    this.graph = this.buildGraph();
  }

  private buildGraph() {
    return new StateGraph(ApplicationPackState)
      .addNode("runGapAnalysis", this.runGapAnalysisNode)
      .addNode(
        "generateResumeImprovementPlan",
        this.generateResumeImprovementPlanNode,
      )
      .addNode("generateCoverLetter", this.generateCoverLetterNode)
      .addNode("generateInterviewPrep", this.generateInterviewPrepNode)
      .addEdge(START, "runGapAnalysis")
      .addConditionalEdges(
        "runGapAnalysis",
        (state: PackState) => {
          if (!state.route) throw new Error("Application pack route was not set after runGapAnalysis");
          return state.route;
        },
        {
          low_fit: "generateResumeImprovementPlan",
          good_fit: "generateCoverLetter",
        },
      )
      .addEdge("generateResumeImprovementPlan", END)
      .addEdge("generateCoverLetter", "generateInterviewPrep")
      .addEdge("generateInterviewPrep", END)
      .compile();
  }

  public async generatePack(
    userId: string,
    applicationId: string,
    force: ApplicationPackForceOptions = {},
  ): Promise<ApplicationPackResult> {
    const finalState = await this.graph.invoke({
      userId,
      applicationId,
      force,
    });

    return {
      route: finalState.route!,
      gapAnalysis: finalState.gapAnalysis!,
      resumeImprovementPlan: finalState.resumeImprovementPlan ?? null,
      coverLetter: finalState.coverLetter ?? null,
      interviewPrep: finalState.interviewPrep ?? null,
    };
  }

  private runGapAnalysisNode = async (state: PackState) => {
    const gapAnalysis = await this.gapAnalysisService.analyze(
      state.userId,
      state.applicationId,
      state.force.gapAnalysis ?? false,
    );
    return { gapAnalysis, route: decideFitRoute(gapAnalysis) };
  };

  private generateResumeImprovementPlanNode = async (state: PackState) => {
    const resumeImprovementPlan = await this.resumeImprovementService.generate(
      state.userId,
      state.applicationId,
      state.force.resumeImprovement ?? false,
    );
    return { resumeImprovementPlan };
  };

  private generateCoverLetterNode = async (state: PackState) => {
    const coverLetter = await this.coverLetterService.generate(
      state.userId,
      state.applicationId,
      state.force.coverLetter ?? false,
    );
    return { coverLetter };
  };

  private generateInterviewPrepNode = async (state: PackState) => {
    const interviewPrep = await this.interviewPrepService.generate(
      state.userId,
      state.applicationId,
      state.force.interviewPrep ?? false,
    );
    return { interviewPrep };
  };
}
