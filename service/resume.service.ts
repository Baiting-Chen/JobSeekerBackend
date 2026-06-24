import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { prisma } from "../lib/prisma";
import { BadRequestError } from "../errors/AppError";

export class ResumeService {
  public async uploadResume(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ resumeFileName: string }> {
    const resumeText = await this.extractText(file);
    await prisma.user.update({
      where: { id: userId },
      data: { resumeText, resumeFileName: file.originalname },
    });
    return { resumeFileName: file.originalname };
  }

  public async getResume(
    userId: string,
  ): Promise<{ resumeFileName: string | null; resumeText: string | null }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { resumeFileName: true, resumeText: true },
    });
    return {
      resumeFileName: user?.resumeFileName ?? null,
      resumeText: user?.resumeText ?? null,
    };
  }

  private async extractText(file: Express.Multer.File): Promise<string> {
    if (file.mimetype === "application/pdf") {
      const parser = new PDFParse({ data: file.buffer });
      const result = await parser.getText();
      return result.text.trim();
    }

    if (
      file.mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      return result.value.trim();
    }

    throw new BadRequestError("Unsupported file type");
  }
}
