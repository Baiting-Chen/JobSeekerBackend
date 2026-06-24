import { prisma } from "../lib/prisma";
import { NotFoundError } from "../errors/AppError";

const PROFILE_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  targetRole: true,
  location: true,
  linkedIn: true,
  createdAt: true,
};

export class UserService {
  public async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: PROFILE_SELECT,
    });
    if (!user) throw new NotFoundError("User not found");
    return user;
  }

  public async updateProfile(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      targetRole?: string;
      location?: string;
      linkedIn?: string;
    },
  ) {
    return prisma.user.update({
      where: { id: userId },
      data,
      select: PROFILE_SELECT,
    });
  }
}
