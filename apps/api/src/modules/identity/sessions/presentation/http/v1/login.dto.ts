import {
  appleMobileCallbackSchema,
  authTokensSchema,
  googleMobileCallbackSchema,
  kakaoMobileCallbackSchema,
  loginSchema,
  logoutResponseSchema,
  naverMobileCallbackSchema,
  refreshTokensSchema,
  revokeSessionSchema,
  sessionListResponseSchema,
  verifyEmailSchema,
} from "@aido/api/contracts/auth/v1";
import type { z } from "zod";

export const LoginDto = loginSchema.meta({ id: "LoginDto" });
export type LoginDto = z.infer<typeof LoginDto>;
export const VerifyEmailDto = verifyEmailSchema.meta({ id: "VerifyEmailDto" });
export type VerifyEmailDto = z.infer<typeof VerifyEmailDto>;
export const RefreshTokensDto = refreshTokensSchema.meta({ id: "RefreshTokensDto" });
export type RefreshTokensDto = z.infer<typeof RefreshTokensDto>;
export const AuthTokensDto = authTokensSchema.meta({ id: "AuthTokensDto" });
export type AuthTokensDto = z.infer<typeof AuthTokensDto>;
export const MessageResponseDto = logoutResponseSchema.meta({ id: "MessageResponseDto" });
export type MessageResponseDto = z.infer<typeof MessageResponseDto>;
export const AppleMobileCallbackDto = appleMobileCallbackSchema.meta({
  id: "AppleMobileCallbackDto",
});
export type AppleMobileCallbackDto = z.infer<typeof AppleMobileCallbackDto>;
export const GoogleMobileCallbackDto = googleMobileCallbackSchema.meta({
  id: "GoogleMobileCallbackDto",
});
export type GoogleMobileCallbackDto = z.infer<typeof GoogleMobileCallbackDto>;
export const KakaoMobileCallbackDto = kakaoMobileCallbackSchema.meta({
  id: "KakaoMobileCallbackDto",
});
export type KakaoMobileCallbackDto = z.infer<typeof KakaoMobileCallbackDto>;
export const NaverMobileCallbackDto = naverMobileCallbackSchema.meta({
  id: "NaverMobileCallbackDto",
});
export type NaverMobileCallbackDto = z.infer<typeof NaverMobileCallbackDto>;
export const RevokeSessionDto = revokeSessionSchema.meta({
  id: "RevokeSessionDto",
  apiParameter: true,
});
export type RevokeSessionDto = z.infer<typeof RevokeSessionDto>;
export const SessionListDto = sessionListResponseSchema.meta({ id: "SessionListDto" });
export type SessionListDto = z.infer<typeof SessionListDto>;
