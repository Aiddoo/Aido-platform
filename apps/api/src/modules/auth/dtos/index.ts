/**
 * Auth DTOs
 *
 * 모든 DTO는 @aido/validators/nestjs에서 가져옵니다.
 */
export {
	// OAuth Mobile Callback DTOs (토큰 기반 서버 검증)
	AppleMobileCallbackDto,
	// Response DTOs
	AuthTokensDto,
	ChangePasswordDto,
	ChangePasswordResponseDto,
	CurrentUserDto,
	ForgotPasswordDto,
	ForgotPasswordResponseDto,
	GoogleMobileCallbackDto,
	KakaoMobileCallbackDto,
	LinkedAccountsResponseDto,
	// Social Account Link DTOs
	LinkSocialAccountDto,
	// Request DTOs
	LoginDto,
	MessageResponseDto,
	NaverMobileCallbackDto,
	RefreshTokenDto,
	RefreshTokensDto,
	RegisterDto,
	RegisterResponseDto,
	ResendVerificationDto,
	ResendVerificationResponseDto,
	ResetPasswordDto,
	ResetPasswordResponseDto,
	RevokeSessionDto,
	SessionArrayDto,
	SessionInfoDto,
	SessionListDto,
	UnlinkAccountDto,
	UnlinkAccountResponseDto,
	UpdateProfileDto,
	UpdateProfileResponseDto,
	UserProfileDto,
	VerifyEmailDto,
} from "@aido/validators/nestjs";
