import {
  currentUserSchema,
  deleteAccountResponseSchema,
  deleteAccountSchema,
  registerSchema,
  updateProfileResponseSchema,
  updateProfileSchema,
} from "@aido/api/contracts/auth";
import type { z } from "zod";

export const RegisterDto = registerSchema.meta({ id: "RegisterDto" });
export type RegisterDto = z.infer<typeof RegisterDto>;
export const UpdateProfileDto = updateProfileSchema.meta({ id: "UpdateProfileDto" });
export type UpdateProfileDto = z.infer<typeof UpdateProfileDto>;
export const DeleteAccountDto = deleteAccountSchema.meta({ id: "DeleteAccountDto" });
export type DeleteAccountDto = z.infer<typeof DeleteAccountDto>;
export const CurrentUserDto = currentUserSchema.meta({ id: "CurrentUserDto" });
export type CurrentUserDto = z.infer<typeof CurrentUserDto>;
export const UpdateProfileResponseDto = updateProfileResponseSchema.meta({
  id: "UpdateProfileResponseDto",
});
export type UpdateProfileResponseDto = z.infer<typeof UpdateProfileResponseDto>;
export const DeleteAccountResponseDto = deleteAccountResponseSchema.meta({
  id: "DeleteAccountResponseDto",
});
export type DeleteAccountResponseDto = z.infer<typeof DeleteAccountResponseDto>;
