import { prisma } from "../lib/prisma";
import { NotFoundError } from "../errors/AppError";
import { ApplicationStatus } from "@prisma/client";

export class ApplicationService {
  public async create(
    userId: string,
    data: {
      url: string;
      company?: string;
      companyDescription?: string;
      position?: string;
      requirements?: string;
      description?: string;
      location?: string;
      salary?: string;
    },
  ) {
    return prisma.application.create({
      data: { ...data, userId },
    });
  }

  public async list(userId: string) {
    return prisma.application.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  public async getById(userId: string, id: string) {
    const application = await prisma.application.findUnique({
      where: { id },
    });
    if (!application || application.userId !== userId) {
      throw new NotFoundError("Application not found");
    }
    return application;
  }

  public async update(
    userId: string,
    id: string,
    data: {
      company?: string;
      companyDescription?: string;
      position?: string;
      requirements?: string;
      description?: string;
      location?: string;
      salary?: string;
      status?: ApplicationStatus;
    },
  ) {
    await this.getById(userId, id);
    return prisma.application.update({ where: { id }, data });
  }

  public async delete(userId: string, id: string) {
    await this.getById(userId, id);
    await prisma.application.delete({ where: { id } });
  }
}
