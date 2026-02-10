import type { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
import { z } from "zod";
import { newRefreshToken, hashToken } from "../auth/refreshToken.js"
import { REFRESH_COOKIE, refreshCookieOptions } from "../auth/cookies.js"

const LoginBody = z.object({
  tenantId: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const accessTTL = () => process.env.JWT_EXPIRES_IN ?? "15m";
const refreshDays = () => Number(process.env.REFRESH_DAYS ?? 30);
const refreshExpiresAt = () =>
  new Date(Date.now() + refreshDays() * 24 * 60 * 60 * 1000);

export async function authRoutes(app: FastifyInstance) {
  app.post(
    "/auth/login",
    {
      schema: {
        tags: ["auth"],
        body: {
          type: "object",
          required: ["tenantId", "email", "password"],
          properties: {
            tenantId: { type: "string", minLength: 1 },
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
          },
        },
        response: {
          200: {
            type: "object",
            required: ["accessToken"],
            properties: { accessToken: { type: "string" } },
          },
          401: {
            type: "object",
            required: ["error"],
            properties: { error: { type: "string" } },
          },
          422: {
            type: "object",
            required: ["error"],
            properties: { error: { type: "string" } },
          },
        },
      },
    },
    async (req, reply) => {
      const parsed = LoginBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(422).send({ error: "invalid_request" });
      }

      const { tenantId, email, password } = parsed.data;

      const user = await app.prisma.user.findFirst({
        where: { tenantId, email },
        select: { id: true, tenantId: true, roleId: true, passwordHash: true },
      });

      if (!user) return reply.code(401).send({ error: "invalid_credentials" });

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return reply.code(401).send({ error: "invalid_credentials" });

      const accessToken = await reply.jwtSign(
        { userId: user.id, tenantId: user.tenantId, roleId: user.roleId },
        { expiresIn: accessTTL() }
      );

      const refreshToken = newRefreshToken();
      const refreshHash = hashToken(refreshToken);
      const expiresAt = refreshExpiresAt();

      await app.prisma.refreshToken.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          tokenHash: refreshHash,
          expiresAt
        },
      });

      reply.setCookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());

      return reply.send({ accessToken });
    }
  );

  app.post("/auth/refresh", async (req, reply) => {
    const token = req.cookies[REFRESH_COOKIE];
    if(!token) return reply.code(401).send({ error: "missing_refresh_token" });

    const tokenHash = hashToken(token);
    const now = new Date();

    const existing = await app.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      select: { id: true, userId: true, tenantId: true },
    });

    if (!existing) return reply.code(401).send({ error: "invalid_refresh_token" });

    const user = await app.prisma.user.findFirst({
      where: { id: existing.userId, tenantId: existing.tenantId },
      select: { id: true, tenantId: true, roleId: true },
    });
    if(!user) return reply.code(401).send({ error: "invalid_refresh_token" });

    await app.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: now },
    });

    const newToken = newRefreshToken();
    const newHash = hashToken(newToken);
    const expiresAt = refreshExpiresAt();

    await app.prisma.refreshToken.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        tokenHash: newHash,
        expiresAt,
      },
    });

    reply.setCookie(REFRESH_COOKIE, newToken, refreshCookieOptions());

    const accessToken = await reply.jwtSign(
      { userId: user.id, tenantId: user.tenantId, roleId: user.roleId },
      { expiresIn: accessTTL() }
    );

    return reply.send({ accessToken });
  });

  app.post("/auth/logout", async (req, reply) => {
    const token = req.cookies[REFRESH_COOKIE];
    if (token) {
      const tokenHash = hashToken(token);
      await app.prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    reply.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
    return reply.code(200).send({ ok: true });
  });
}
