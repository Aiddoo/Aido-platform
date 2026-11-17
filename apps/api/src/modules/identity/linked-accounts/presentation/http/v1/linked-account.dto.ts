import {
  changePasswordSchema,
  forgotPasswordSchema,
  linkSocialAccountSchema,
  linkedAccountsResponseSchema,
  resetPasswordSchema,
  setPasswordSchema,
  unlinkAccountSchema,
} from "@aido/api/contracts/auth";
import type { z } from "zod";

export const ForgotPasswordDto = forgotPasswordSchema.meta({ id: "ForgotPasswordDto" });
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordDto>;
export const ResetPasswordDto = resetPasswordSchema.meta({ id: "ResetPasswordDto" });
export type ResetPasswordDto = z.infer<typeof ResetPasswordDto>;
export const ChangePasswordDto = changePasswordSchema.meta({ id: "ChangePasswordDto" });
export type ChangePasswordDto = z.infer<typeof ChangePasswordDto>;
export const SetPasswordDto = setPasswordSchema.meta({ id: "SetPasswordDto" });
export type SetPasswordDto = z.infer<typeof SetPasswordDto>;
export const LinkSocialAccountDto = linkSocialAccountSchema.meta({ id: "LinkSocialAccountDto" });
export type LinkSocialAccountDto = z.infer<typeof LinkSocialAccountDto>;
export const UnlinkAccountDto = unlinkAccountSchema.meta({
  id: "UnlinkAccountDto",
  apiParameter: true,
});
export type UnlinkAccountDto = z.infer<typeof UnlinkAccountDto>;
export const LinkedAccountsResponseDto = linkedAccountsResponseSchema.meta({
  id: "LinkedAccountsResponseDto",
});
export type LinkedAccountsResponseDto = z.infer<typeof LinkedAccountsResponseDto>;
