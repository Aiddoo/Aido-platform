import { z } from "zod";

// https://developers.google.com/identity/protocols/oauth2/web-server#exchange-authorization-code
export const googleTokenResponseSchema = z.object({ id_token: z.string() });

// https://developers.google.com/identity/sign-in/web/backend-auth (google-auth-library가 서명을 검증한 payload)
export const googleIdTokenPayloadSchema = z.looseObject({
  sub: z.string().optional(),
  email: z.string().optional(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
  picture: z.string().optional(),
});
