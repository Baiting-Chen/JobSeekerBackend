import { BadRequestError, UnauthorizedError } from "../errors/AppError";
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

export class AuthService {
  private readonly accessSecret = this.requireEnv("JWT_ACCESS_SECRET");
  private readonly refreshSecret = this.requireEnv("JWT_REFRESH_SECRET");

  /**
   * register function
   */
  public async register(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    targetRole?: string;
    location?: string;
    linkedIn?: string;
  }) {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) throw new BadRequestError("Email already in use");

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        targetRole: input.targetRole,
        location: input.location,
        linkedIn: input.linkedIn,
      },
    });
    return this.issueTokens(user.id);
  }

  /**
   * login function
   */
  public async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user) throw new UnauthorizedError("Invalid credentials");

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedError("Invalid credentials");

    return this.issueTokens(user.id);
  }

  public async refresh(rawRefreshToken: string) {
    const { userId } = this.verifyToken(rawRefreshToken, this.refreshSecret);
    const tokenHash = this.hashToken(rawRefreshToken);
    // use transaction here to avoid problem when deleting a token successfully while create token fail
    return prisma.$transaction(async (tx) => {
      const deleted = await tx.refreshToken.deleteMany({
        where: { tokenHash, userId, expiresAt: { gt: new Date() } },
      });
      if (deleted.count === 0) {
        throw new UnauthorizedError("Invalid or expired refresh token");
      }
      return this.issueTokens(userId, tx);
    });
  }

  public async logout(rawRefreshToken: string) {
    const tokenHash = this.hashToken(rawRefreshToken);
    await prisma.refreshToken.deleteMany({ where: { tokenHash } });
  }

  private async issueTokens(
    userId: string,
    client: PrismaClientOrTransaction = prisma,
  ) {
    const accessToken = jwt.sign({ userId }, this.accessSecret, {
      expiresIn: "15m",
    });
    /**
     * add a jti to refresh token in case it might be repetitive
     */
    const refreshTokenId = crypto.randomUUID();
    const refreshToken = jwt.sign(
      { userId, jti: refreshTokenId },
      this.refreshSecret,
      {
        expiresIn: "7d",
      },
    );
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await client.refreshToken.deleteMany({
      where: { userId, expiresAt: { lt: new Date() } },
    });
    await client.refreshToken.create({
      data: { tokenHash, userId, expiresAt },
    });
    return { accessToken, refreshToken };
  }

  public verifyAccessToken(token: string): { userId: string } {
    return this.verifyToken(token, this.accessSecret);
  }

  /**
   * hash token
   */
  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * read from Env function
   */
  private requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Missing environment variable: ${name}`);
    }
    return value;
  }

  /**
   * JWT verify function
   */
  private verifyToken(token: string, secret: string): { userId: string } {
    try {
      const payload = jwt.verify(token, secret);
      if (
        typeof payload !== "object" ||
        payload === null ||
        typeof payload.userId !== "string"
      ) {
        throw new UnauthorizedError("Invalid token payload");
      }

      return { userId: payload.userId };
    } catch {
      throw new UnauthorizedError("Invalid or expired token");
    }
  }
}
