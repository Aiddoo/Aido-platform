import type {
  changePasswordSchema,
  deleteAccountSchema,
  exchangeCodeSchema,
  forgotPasswordSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '@aido/api';
import type { z } from 'zod';

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
export type ExchangeCodeInput = z.infer<typeof exchangeCodeSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type RegisterInput = z.input<typeof registerSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
