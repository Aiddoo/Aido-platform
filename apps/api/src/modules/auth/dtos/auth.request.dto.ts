import {
	appleMobileCallbackSchema,
	changePasswordSchema,
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
	unlinkAccountSchema,
	updateProfileSchema,
	verifyEmailSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class RegisterDto extends createZodDto(registerSchema) {}
export class LoginDto extends createZodDto(loginSchema) {}
export class VerifyEmailDto extends createZodDto(verifyEmailSchema) {}
export class ResendVerificationDto extends createZodDto(
	resendVerificationSchema,
) {}
export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}
export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}
export class ChangePasswordDto extends createZodDto(changePasswordSchema) {}
export class RefreshTokenDto extends createZodDto(refreshTokenSchema) {}
export class ExchangeCodeDto extends createZodDto(exchangeCodeSchema) {}
export class RevokeSessionDto extends createZodDto(revokeSessionSchema) {}
export class UpdateProfileDto extends createZodDto(updateProfileSchema) {}

export class AppleMobileCallbackDto extends createZodDto(
	appleMobileCallbackSchema,
) {}
export class GoogleMobileCallbackDto extends createZodDto(
	googleMobileCallbackSchema,
) {}
export class KakaoMobileCallbackDto extends createZodDto(
	kakaoMobileCallbackSchema,
) {}
export class NaverMobileCallbackDto extends createZodDto(
	naverMobileCallbackSchema,
) {}
export class LinkSocialAccountDto extends createZodDto(
	linkSocialAccountSchema,
) {}
export class UnlinkAccountDto extends createZodDto(unlinkAccountSchema) {}
