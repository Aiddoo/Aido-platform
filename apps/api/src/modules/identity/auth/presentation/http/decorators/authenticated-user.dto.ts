import { type CurrentUserPayload, userRoleSchema } from "@aido/api/contracts/auth";
import { z } from "zod";

/** JwtAuthGuard가 `req.user`에 둔 access 토큰 사용자를 HTTP 경계에서 확인한다. */
export const authenticatedUserSchema = z.object({
  userId: z.string(),
  email: z.string(),
  sessionId: z.string(),
  role: userRoleSchema,
}) satisfies z.ZodType<CurrentUserPayload>;

/** JwtRefreshGuard가 `req.user`에 둔 사용자와 원본 refresh 토큰을 확인한다. */
export const refreshTokenUserSchema = authenticatedUserSchema.extend({
  refreshToken: z.string(),
});

export type RefreshTokenUser = z.infer<typeof refreshTokenUserSchema>;
