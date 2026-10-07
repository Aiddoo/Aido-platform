import {
  appleMobileCallbackSchema,
  changePasswordSchema,
  deleteAccountSchema,
  exchangeCodeSchema,
  forgotPasswordSchema,
  googleMobileCallbackSchema,
  kakaoMobileCallbackSchema,
  linkSocialAccountSchema,
  loginSchema,
  naverMobileCallbackSchema,
  refreshTokenSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  revokeSessionSchema,
  setPasswordSchema,
  unlinkAccountSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from "@aido/validators";
import type { z } from "zod";

export const RegisterDto = registerSchema.meta({ id: "RegisterDto" });
export type RegisterDto = z.infer<typeof RegisterDto>;
export const LoginDto = loginSchema.meta({ id: "LoginDto" });
export type LoginDto = z.infer<typeof LoginDto>;
export const VerifyEmailDto = verifyEmailSchema.meta({ id: "VerifyEmailDto" });
export type VerifyEmailDto = z.infer<typeof VerifyEmailDto>;
export const ResendVerificationDto = resendVerificationSchema.meta({ id: "ResendVerificationDto" });
export type ResendVerificationDto = z.infer<typeof ResendVerificationDto>;
export const ForgotPasswordDto = forgotPasswordSchema.meta({ id: "ForgotPasswordDto" });
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordDto>;
export const ResetPasswordDto = resetPasswordSchema.meta({ id: "ResetPasswordDto" });
export type ResetPasswordDto = z.infer<typeof ResetPasswordDto>;
export const ChangePasswordDto = changePasswordSchema.meta({ id: "ChangePasswordDto" });
export type ChangePasswordDto = z.infer<typeof ChangePasswordDto>;
export const SetPasswordDto = setPasswordSchema.meta({ id: "SetPasswordDto" });
export type SetPasswordDto = z.infer<typeof SetPasswordDto>;
export const RefreshTokenDto = refreshTokenSchema.meta({ id: "RefreshTokenDto" });
export type RefreshTokenDto = z.infer<typeof RefreshTokenDto>;
export const ExchangeCodeDto = exchangeCodeSchema.meta({ id: "ExchangeCodeDto" });
export type ExchangeCodeDto = z.infer<typeof ExchangeCodeDto>;
export const RevokeSessionDto = revokeSessionSchema.meta({ id: "RevokeSessionDto" });
export type RevokeSessionDto = z.infer<typeof RevokeSessionDto>;
export const UpdateProfileDto = updateProfileSchema.meta({ id: "UpdateProfileDto" });
export type UpdateProfileDto = z.infer<typeof UpdateProfileDto>;

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
export const LinkSocialAccountDto = linkSocialAccountSchema.meta({ id: "LinkSocialAccountDto" });
export type LinkSocialAccountDto = z.infer<typeof LinkSocialAccountDto>;
export const UnlinkAccountDto = unlinkAccountSchema.meta({ id: "UnlinkAccountDto" });
export type UnlinkAccountDto = z.infer<typeof UnlinkAccountDto>;
export const DeleteAccountDto = deleteAccountSchema.meta({ id: "DeleteAccountDto" });
export type DeleteAccountDto = z.infer<typeof DeleteAccountDto>;
