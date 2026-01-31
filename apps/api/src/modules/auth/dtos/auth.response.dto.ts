import {
	authTokensSchema,
	changePasswordResponseSchema,
	currentUserSchema,
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
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class AuthTokensDto extends createZodDto(authTokensSchema) {}
export class RefreshTokensDto extends createZodDto(refreshTokensSchema) {}
export class CurrentUserDto extends createZodDto(currentUserSchema) {}
export class UserProfileDto extends createZodDto(userProfileSchema) {}
export class SessionInfoDto extends createZodDto(sessionInfoSchema) {}
export class SessionListDto extends createZodDto(sessionListResponseSchema) {}
export class SessionArrayDto extends createZodDto(sessionListSchema) {}
export class MessageResponseDto extends createZodDto(logoutResponseSchema) {}
export class RegisterResponseDto extends createZodDto(registerResponseSchema) {}
export class ForgotPasswordResponseDto extends createZodDto(
	forgotPasswordResponseSchema,
) {}
export class ResetPasswordResponseDto extends createZodDto(
	resetPasswordResponseSchema,
) {}
export class ChangePasswordResponseDto extends createZodDto(
	changePasswordResponseSchema,
) {}
export class ResendVerificationResponseDto extends createZodDto(
	resendVerificationResponseSchema,
) {}
export class UpdateProfileResponseDto extends createZodDto(
	updateProfileResponseSchema,
) {}
export class LinkedAccountsResponseDto extends createZodDto(
	linkedAccountsResponseSchema,
) {}
export class UnlinkAccountResponseDto extends createZodDto(
	unlinkAccountResponseSchema,
) {}
