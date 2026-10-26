import { type CurrentUserPayload, userRoleSchema } from "@aido/api";
import { z } from "zod";

import type { RefreshTokenPayload } from "#api/modules/identity/infrastructure/strategies/auth/jwt-refresh.strategy";

/** Passport strategy가 `req.user`에 둔 access token 사용자를 HTTP 경계에서 확인한다. */
export const authenticatedUserSchema = z.object({
  userId: z.string(),
  email: z.string(),
  sessionId: z.string(),
  role: userRoleSchema,
}) satisfies z.ZodType<CurrentUserPayload>;

/** refresh strategy가 `req.user`에 둔 사용자와 원본 refresh token을 확인한다. */
export const refreshTokenUserSchema = authenticatedUserSchema.extend({
  refreshToken: z.string(),
}) satisfies z.ZodType<RefreshTokenPayload>;
