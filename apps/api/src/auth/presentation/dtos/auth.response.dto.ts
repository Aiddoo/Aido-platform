import {
  authTokensSchema,
  changePasswordResponseSchema,
  currentUserSchema,
  deleteAccountResponseSchema,
  forgotPasswordResponseSchema,
  linkedAccountsResponseSchema,
  logoutResponseSchema,
  refreshTokensSchema,
  registerResponseSchema,
  resendVerificationResponseSchema,
  resetPasswordResponseSchema,
  sessionInfoSchema,
  sessionListResponseSchema,
  sessionListSchema,
  unlinkAccountResponseSchema,
  updateProfileResponseSchema,
  userProfileSchema,
} from "@aido/api";
import type { z } from "zod";

export const AuthTokensDto = authTokensSchema.meta({ id: "AuthTokensDto" });
export type AuthTokensDto = z.infer<typeof AuthTokensDto>;
export const RefreshTokensDto = refreshTokensSchema.meta({ id: "RefreshTokensDto" });
export type RefreshTokensDto = z.infer<typeof RefreshTokensDto>;
export const CurrentUserDto = currentUserSchema.meta({ id: "CurrentUserDto" });
export type CurrentUserDto = z.infer<typeof CurrentUserDto>;
export const UserProfileDto = userProfileSchema.meta({ id: "UserProfileDto" });
export type UserProfileDto = z.infer<typeof UserProfileDto>;
export const SessionInfoDto = sessionInfoSchema.meta({ id: "SessionInfoDto" });
export type SessionInfoDto = z.infer<typeof SessionInfoDto>;
export const SessionListDto = sessionListResponseSchema.meta({ id: "SessionListDto" });
export type SessionListDto = z.infer<typeof SessionListDto>;
export const SessionArrayDto = sessionListSchema.meta({ id: "SessionArrayDto" });
export type SessionArrayDto = z.infer<typeof SessionArrayDto>;
export const MessageResponseDto = logoutResponseSchema.meta({ id: "MessageResponseDto" });
export type MessageResponseDto = z.infer<typeof MessageResponseDto>;
export const RegisterResponseDto = registerResponseSchema.meta({ id: "RegisterResponseDto" });
export type RegisterResponseDto = z.infer<typeof RegisterResponseDto>;
export const ForgotPasswordResponseDto = forgotPasswordResponseSchema.meta({
  id: "ForgotPasswordResponseDto",
});
export type ForgotPasswordResponseDto = z.infer<typeof ForgotPasswordResponseDto>;
export const ResetPasswordResponseDto = resetPasswordResponseSchema.meta({
  id: "ResetPasswordResponseDto",
});
export type ResetPasswordResponseDto = z.infer<typeof ResetPasswordResponseDto>;
export const ChangePasswordResponseDto = changePasswordResponseSchema.meta({
  id: "ChangePasswordResponseDto",
});
export type ChangePasswordResponseDto = z.infer<typeof ChangePasswordResponseDto>;
export const ResendVerificationResponseDto = resendVerificationResponseSchema.meta({
  id: "ResendVerificationResponseDto",
});
export type ResendVerificationResponseDto = z.infer<typeof ResendVerificationResponseDto>;
export const UpdateProfileResponseDto = updateProfileResponseSchema.meta({
  id: "UpdateProfileResponseDto",
});
export type UpdateProfileResponseDto = z.infer<typeof UpdateProfileResponseDto>;
export const LinkedAccountsResponseDto = linkedAccountsResponseSchema.meta({
  id: "LinkedAccountsResponseDto",
});
export type LinkedAccountsResponseDto = z.infer<typeof LinkedAccountsResponseDto>;
export const UnlinkAccountResponseDto = unlinkAccountResponseSchema.meta({
  id: "UnlinkAccountResponseDto",
});
export type UnlinkAccountResponseDto = z.infer<typeof UnlinkAccountResponseDto>;
export const DeleteAccountResponseDto = deleteAccountResponseSchema.meta({
  id: "DeleteAccountResponseDto",
});
export type DeleteAccountResponseDto = z.infer<typeof DeleteAccountResponseDto>;
