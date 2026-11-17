import { z } from "zod";

export const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
export const APPLE_ISSUER = "https://appleid.apple.com";

// https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_rest_api/verifying_a_user
// 서명·iss·aud·exp는 jose jwtVerify가 검증하고 여기서는 쓰는 claim의 모양만 본다
export const appleIdTokenClaimsSchema = z.looseObject({
  sub: z.string(),
  email: z.string().optional(),
  email_verified: z.union([z.string(), z.boolean()]).optional(),
  nonce: z.string().optional(),
});
