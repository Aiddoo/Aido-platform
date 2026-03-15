import { ErrorCode, type ErrorCodeType, Errors } from "@aido/errors";
import { HttpException } from "@nestjs/common";

/**
 * 비즈니스 예외 클래스
 */
export class BusinessException extends HttpException {
	constructor(
		public readonly errorCode: ErrorCodeType,
		public readonly details?: unknown,
		message?: string,
		statusCode?: number,
	) {
		const errorDef = Errors[errorCode];
		const errorMessage = message || errorDef.message;
		const httpStatus = statusCode || errorDef.httpStatus;

		super(
			{
				success: false,
				error: {
					code: errorCode,
					message: errorMessage,
					details,
				},
				timestamp: Date.now(),
			},
			httpStatus,
		);
	}
}

/**
 * 비즈니스 예외 팩토리 클래스
 */
export class BusinessExceptions {
	// =========================================================================
	// 공통 (Common)
	// =========================================================================
	static userNotFound(userId: string) {
		return new BusinessException(ErrorCode.USER_0601, { userId });
	}

	static todoNotFound(todoId: number) {
		return new BusinessException(ErrorCode.TODO_0801, { todoId });
	}

	static invalidParameter(details?: unknown) {
		return new BusinessException(ErrorCode.SYS_0002, details);
	}

	static internalServerError(details?: unknown) {
		return new BusinessException(ErrorCode.SYS_0001, details);
	}

	// =========================================================================
	// 동시성 관련 (Concurrency)
	// =========================================================================
	static optimisticLockError() {
		return new BusinessException(ErrorCode.SYS_0003);
	}

	static concurrentModification() {
		return new BusinessException(ErrorCode.SYS_0004);
	}

	// =========================================================================
	// JWT 인증 관련 (JWT Authentication)
	// =========================================================================
	static invalidToken(details?: unknown) {
		return new BusinessException(ErrorCode.AUTH_0101, details);
	}

	static tokenExpired() {
		return new BusinessException(ErrorCode.AUTH_0102);
	}

	static tokenMalformed() {
		return new BusinessException(ErrorCode.AUTH_0103);
	}

	static refreshTokenInvalid() {
		return new BusinessException(ErrorCode.AUTH_0104);
	}

	static refreshTokenExpired() {
		return new BusinessException(ErrorCode.AUTH_0105);
	}

	static tokenRevoked() {
		return new BusinessException(ErrorCode.AUTH_0106);
	}

	static authenticationRequired() {
		return new BusinessException(ErrorCode.AUTH_0107);
	}

	static unauthorizedAccess(details?: unknown) {
		return new BusinessException(ErrorCode.AUTH_0108, details);
	}

	// =========================================================================
	// 소셜 로그인 관련 (Social Login)
	// =========================================================================
	static socialAuthFailed(provider: string, details?: Record<string, unknown>) {
		return new BusinessException(ErrorCode.SOCIAL_0201, {
			provider,
			...details,
		});
	}

	static socialTokenInvalid(provider: string) {
		return new BusinessException(ErrorCode.SOCIAL_0202, { provider });
	}

	static socialTokenExpired(provider: string) {
		return new BusinessException(ErrorCode.SOCIAL_0203, { provider });
	}

	static socialProviderError(
		provider: string,
		details?: Record<string, unknown>,
	) {
		return new BusinessException(ErrorCode.SOCIAL_0204, {
			provider,
			...details,
		});
	}

	static socialEmailNotProvided(provider: string) {
		return new BusinessException(ErrorCode.SOCIAL_0205, {
			provider,
		});
	}

	static socialAccountNotLinked(
		provider: string,
		providerAccountId: string,
		email: string,
	) {
		return new BusinessException(ErrorCode.SOCIAL_0206, {
			provider,
			providerAccountId,
			email,
		});
	}

	// =========================================================================
	// 카카오 로그인 (Kakao Login)
	// =========================================================================
	static kakaoAuthFailed(details?: Record<string, unknown>) {
		return new BusinessException(ErrorCode.KAKAO_0301, details);
	}

	static kakaoAuthCodeInvalid() {
		return new BusinessException(ErrorCode.KAKAO_0302);
	}

	static kakaoTokenRequestFailed(details?: unknown) {
		return new BusinessException(ErrorCode.KAKAO_0303, details);
	}

	static kakaoUserInfoFailed(details?: unknown) {
		return new BusinessException(ErrorCode.KAKAO_0305, details);
	}

	static kakaoAccountAlreadyLinked(kakaoId: string) {
		return new BusinessException(ErrorCode.KAKAO_0306, {
			kakaoId,
		});
	}

	static kakaoUnlinkFailed(details?: unknown) {
		return new BusinessException(ErrorCode.KAKAO_0307, details);
	}

	// =========================================================================
	// 애플 로그인 (Apple Login)
	// =========================================================================
	static appleAuthFailed(details?: Record<string, unknown>) {
		return new BusinessException(ErrorCode.APPLE_0351, details);
	}

	static appleIdTokenInvalid() {
		return new BusinessException(ErrorCode.APPLE_0352);
	}

	static appleAuthCodeInvalid() {
		return new BusinessException(ErrorCode.APPLE_0353);
	}

	static appleTokenVerificationFailed(details?: unknown) {
		return new BusinessException(ErrorCode.APPLE_0354, details);
	}

	static appleAccountAlreadyLinked(appleId: string) {
		return new BusinessException(ErrorCode.APPLE_0355, {
			appleId,
		});
	}

	static appleUnlinkFailed(details?: unknown) {
		return new BusinessException(ErrorCode.APPLE_0356, details);
	}

	static appleRevokeTokenFailed(details?: unknown) {
		return new BusinessException(ErrorCode.APPLE_0357, details);
	}

	// =========================================================================
	// 구글 로그인 (Google Login)
	// =========================================================================
	static googleAuthFailed(details?: Record<string, unknown>) {
		return new BusinessException(ErrorCode.GOOGLE_0401, details);
	}

	static googleTokenInvalid() {
		return new BusinessException(ErrorCode.GOOGLE_0402);
	}

	static googleEmailNotProvided() {
		return new BusinessException(ErrorCode.GOOGLE_0404);
	}

	static googleAccountAlreadyLinked(googleId: string) {
		return new BusinessException(ErrorCode.GOOGLE_0405, {
			googleId,
		});
	}

	static googleUnlinkFailed(details?: unknown) {
		return new BusinessException(ErrorCode.GOOGLE_0406, details);
	}

	// =========================================================================
	// 네이버 로그인 (Naver Login)
	// =========================================================================
	static naverAuthFailed(details?: Record<string, unknown>) {
		return new BusinessException(ErrorCode.NAVER_0451, details);
	}

	static naverTokenInvalid() {
		return new BusinessException(ErrorCode.NAVER_0452);
	}

	static naverUserInfoFailed(details?: unknown) {
		return new BusinessException(ErrorCode.NAVER_0454, details);
	}

	static naverAccountAlreadyLinked(naverId: string) {
		return new BusinessException(ErrorCode.NAVER_0455, {
			naverId,
		});
	}

	static naverUnlinkFailed(details?: unknown) {
		return new BusinessException(ErrorCode.NAVER_0456, details);
	}

	// =========================================================================
	// 이메일 인증 (Email Authentication)
	// =========================================================================
	static emailAlreadyRegistered(email: string) {
		return new BusinessException(ErrorCode.EMAIL_0501, {
			email,
		});
	}

	static emailNotFound(email: string) {
		return new BusinessException(ErrorCode.EMAIL_0502, { email });
	}

	static emailNotVerified(email: string) {
		return new BusinessException(ErrorCode.EMAIL_0503, { email });
	}

	static emailVerificationCodeInvalid() {
		return new BusinessException(ErrorCode.EMAIL_0504);
	}

	static emailVerificationCodeExpired() {
		return new BusinessException(ErrorCode.EMAIL_0505);
	}

	static emailSendFailed(email: string, details?: Record<string, unknown>) {
		return new BusinessException(ErrorCode.EMAIL_0506, {
			email,
			...details,
		});
	}

	static invalidCredentials() {
		return new BusinessException(ErrorCode.USER_0602);
	}

	static invalidPassword() {
		return new BusinessException(ErrorCode.EMAIL_0507);
	}

	static passwordMismatch() {
		return new BusinessException(ErrorCode.EMAIL_0508);
	}

	// =========================================================================
	// 계정 관련 (Account)
	// =========================================================================
	static accountNotFound(provider?: string) {
		return new BusinessException(ErrorCode.USER_0603, { provider });
	}

	static accountAlreadyExists(details?: unknown) {
		return new BusinessException(ErrorCode.USER_0604, details);
	}

	static accountSuspended(userId: string) {
		return new BusinessException(ErrorCode.USER_0605, { userId });
	}

	static accountDeleted(userId: string) {
		return new BusinessException(ErrorCode.USER_0606, { userId });
	}

	static accountLocked(email: string, remainingMinutes?: number) {
		return new BusinessException(ErrorCode.USER_0607, {
			email,
			remainingMinutes,
		});
	}

	static accountPendingVerification(email: string) {
		return new BusinessException(ErrorCode.USER_0608, {
			email,
		});
	}

	static cannotUnlinkLastAccount() {
		return new BusinessException(ErrorCode.USER_0610);
	}

	static userTagGenerationFailed(details?: {
		userId?: string;
		attempts?: number;
	}) {
		return new BusinessException(ErrorCode.USER_0611, details);
	}

	static accountDeletionPasswordRequired() {
		return new BusinessException(ErrorCode.USER_0612);
	}

	static noCredentialAccountForPasswordChange(userId: string) {
		return new BusinessException(ErrorCode.USER_0613, { userId });
	}

	static credentialAccountAlreadyExists(userId: string) {
		return new BusinessException(ErrorCode.USER_0614, { userId });
	}

	// =========================================================================
	// 로그인 시도 제한 (Login Attempts)
	// =========================================================================
	static tooManyLoginAttempts(email: string, remainingMinutes: number) {
		return new BusinessException(ErrorCode.USER_0609, {
			email,
			remainingMinutes,
		});
	}

	// =========================================================================
	// 세션 관련 (Session)
	// =========================================================================
	static sessionNotFound(sessionId?: string) {
		return new BusinessException(ErrorCode.SESSION_0701, { sessionId });
	}

	static sessionExpired(sessionId?: string) {
		return new BusinessException(ErrorCode.SESSION_0702, { sessionId });
	}

	static sessionRevoked(sessionId?: string, reason?: string) {
		return new BusinessException(ErrorCode.SESSION_0703, {
			sessionId,
			reason,
		});
	}

	// =========================================================================
	// 토큰 보안 (Token Security)
	// =========================================================================
	static tokenReuseDetected(tokenFamily?: string) {
		return new BusinessException(ErrorCode.SESSION_0704, {
			tokenFamily,
		});
	}

	// =========================================================================
	// 인증 코드 (Verification)
	// =========================================================================
	static verificationCodeInvalid() {
		return new BusinessException(ErrorCode.VERIFY_0751);
	}

	static verificationCodeExpired() {
		return new BusinessException(ErrorCode.VERIFY_0752);
	}

	static verificationResendTooSoon(remainingSeconds: number) {
		return new BusinessException(ErrorCode.VERIFY_0753, {
			remainingSeconds,
		});
	}

	static verificationMaxAttemptsExceeded() {
		return new BusinessException(ErrorCode.VERIFY_0754);
	}

	// =========================================================================
	// 친구/팔로우 (Follow)
	// =========================================================================
	static followRequestAlreadySent(targetUserId: string) {
		return new BusinessException(ErrorCode.FOLLOW_0901, { targetUserId });
	}

	static alreadyFriends(targetUserId: string) {
		return new BusinessException(ErrorCode.FOLLOW_0902, { targetUserId });
	}

	static followRequestNotFound(targetUserId?: string) {
		return new BusinessException(ErrorCode.FOLLOW_0903, { targetUserId });
	}

	static cannotFollowSelf() {
		return new BusinessException(ErrorCode.FOLLOW_0904);
	}

	static followTargetNotFound(targetUserId: string) {
		return new BusinessException(ErrorCode.FOLLOW_0905, { targetUserId });
	}

	static followTargetNotFoundByTag(userTag: string) {
		return new BusinessException(ErrorCode.FOLLOW_0905, { userTag });
	}

	static notFriendsCannotViewTodos(targetUserId: string) {
		return new BusinessException(ErrorCode.FOLLOW_0906, { targetUserId });
	}

	static notFriends(targetUserId: string) {
		return new BusinessException(ErrorCode.FOLLOW_0907, { targetUserId });
	}

	static reverseRequestExists(targetUserId: string) {
		return new BusinessException(ErrorCode.FOLLOW_0908, { targetUserId });
	}

	static friendLimitExceeded(current: number, limit: number) {
		return new BusinessException(ErrorCode.FOLLOW_0909, { current, limit });
	}

	static friendReorderTargetNotFound(targetFollowId: string) {
		return new BusinessException(ErrorCode.FOLLOW_0910, { targetFollowId });
	}

	// =========================================================================
	// 알림/푸시 (Notification)
	// =========================================================================
	static invalidPushToken(token?: string) {
		return new BusinessException(ErrorCode.NOTIFICATION_1001, { token });
	}

	static pushTokenNotFound(userId: string) {
		return new BusinessException(ErrorCode.NOTIFICATION_1002, { userId });
	}

	static pushSendFailed(details?: unknown) {
		return new BusinessException(ErrorCode.NOTIFICATION_1003, details);
	}

	static notificationNotFound(notificationId: number) {
		return new BusinessException(ErrorCode.NOTIFICATION_1004, {
			notificationId,
		});
	}

	static notificationAccessDenied(notificationId: number) {
		return new BusinessException(ErrorCode.NOTIFICATION_1005, {
			notificationId,
		});
	}

	// =========================================================================
	// 콕 찌르기 (Nudge)
	// =========================================================================
	static nudgeDailyLimitExceeded(limit: number) {
		return new BusinessException(ErrorCode.NUDGE_1101, { limit });
	}

	static nudgeCooldownActive(targetUserId: string, remainingSeconds: number) {
		return new BusinessException(ErrorCode.NUDGE_1102, {
			targetUserId,
			remainingSeconds,
		});
	}

	static nudgeNotFriend(targetUserId: string) {
		return new BusinessException(ErrorCode.NUDGE_1103, { targetUserId });
	}

	static cannotNudgeSelf() {
		return new BusinessException(ErrorCode.NUDGE_1104);
	}

	static nudgeNotFound(nudgeId: number) {
		return new BusinessException(ErrorCode.NUDGE_1105, { nudgeId });
	}

	static nudgeTodoNotToday(todoId: number) {
		return new BusinessException(ErrorCode.NUDGE_1106, { todoId });
	}

	static remindNudgeFriendHasTodos(receiverId: string) {
		return new BusinessException(ErrorCode.NUDGE_1107, { receiverId });
	}

	static remindNudgeCooldownActive(
		targetUserId: string,
		remainingSeconds: number,
	) {
		return new BusinessException(ErrorCode.NUDGE_1108, {
			targetUserId,
			remainingSeconds,
		});
	}

	// =========================================================================
	// 응원 (Cheer)
	// =========================================================================
	static cheerDailyLimitExceeded(limit: number) {
		return new BusinessException(ErrorCode.CHEER_1201, { limit });
	}

	static cheerCooldownActive(targetUserId: string, remainingSeconds: number) {
		return new BusinessException(ErrorCode.CHEER_1202, {
			targetUserId,
			remainingSeconds,
		});
	}

	static cheerNotFriend(targetUserId: string) {
		return new BusinessException(ErrorCode.CHEER_1203, { targetUserId });
	}

	static cannotCheerSelf() {
		return new BusinessException(ErrorCode.CHEER_1204);
	}

	static cheerNotFound(cheerId: number) {
		return new BusinessException(ErrorCode.CHEER_1205, { cheerId });
	}

	// =========================================================================
	// AI 서비스 (AI)
	// =========================================================================
	static aiServiceUnavailable() {
		return new BusinessException(ErrorCode.AI_1301);
	}

	static aiParseFailed(details?: string) {
		return new BusinessException(ErrorCode.AI_1302, { details });
	}

	static aiUsageLimitExceeded(used: number, limit: number) {
		return new BusinessException(ErrorCode.AI_1303, { used, limit });
	}

	static aiReportNotFound(reportId: number) {
		return new BusinessException(ErrorCode.AI_1304, { reportId });
	}

	static aiSuggestionNotFound(suggestionId: number) {
		return new BusinessException(ErrorCode.AI_1305, { suggestionId });
	}

	static aiSuggestionAlreadyProcessed(suggestionId: number, status: string) {
		return new BusinessException(ErrorCode.AI_1306, {
			suggestionId,
			currentStatus: status,
		});
	}

	static aiSuggestionExpired(suggestionId: number) {
		return new BusinessException(ErrorCode.AI_1307, { suggestionId });
	}

	static aiReportPremiumRequired() {
		return new BusinessException(ErrorCode.AI_1308);
	}

	static aiSuggestionPremiumRequired() {
		return new BusinessException(ErrorCode.AI_1309);
	}

	static aiRateLimitExceeded() {
		return new BusinessException(ErrorCode.AI_1310);
	}

	// =========================================================================
	// Todo 카테고리 (TodoCategory)
	// =========================================================================
	static todoCategoryNotFound(categoryId: number) {
		return new BusinessException(ErrorCode.TODO_CATEGORY_0851, { categoryId });
	}

	static todoCategoryAccessDenied(categoryId: number) {
		return new BusinessException(ErrorCode.TODO_CATEGORY_0852, { categoryId });
	}

	static todoCategoryNameDuplicate(name: string) {
		return new BusinessException(ErrorCode.TODO_CATEGORY_0853, { name });
	}

	static todoCategoryMinimumRequired() {
		return new BusinessException(ErrorCode.TODO_CATEGORY_0854);
	}

	static todoCategoryHasTodos(categoryId: number, todoCount: number) {
		return new BusinessException(ErrorCode.TODO_CATEGORY_0855, {
			categoryId,
			todoCount,
		});
	}

	static todoCategoryMoveTargetRequired() {
		return new BusinessException(ErrorCode.TODO_CATEGORY_0856);
	}

	static todoCategoryFull(activeCount: number, maxPerCategory: number) {
		return new BusinessException(ErrorCode.TODO_0811, {
			activeCount,
			maxPerCategory,
		});
	}

	static todoCategoryLimitExceeded(current: number, limit: number) {
		return new BusinessException(ErrorCode.TODO_CATEGORY_0857, {
			current,
			limit,
		});
	}

	static todoReorderTargetNotFound(targetTodoId: number) {
		return new BusinessException(ErrorCode.TODO_0810, { targetTodoId });
	}

	static recurringTodoInstanceLimitExceeded(count: number, limit: number) {
		return new BusinessException(ErrorCode.TODO_0812, { count, limit });
	}

	static recurringTodoWouldExceedCategoryLimit(
		activeInCategory: number,
		batchSize: number,
		maxPerCategory: number,
	) {
		return new BusinessException(ErrorCode.TODO_0813, {
			activeInCategory,
			batchSize,
			maxPerCategory,
		});
	}

	// =========================================================================
	// 관리자 (Admin)
	// =========================================================================
	static adminRequired() {
		return new BusinessException(ErrorCode.ADMIN_1401);
	}

	static adminNotificationTargetNotFound() {
		return new BusinessException(ErrorCode.ADMIN_1402);
	}

	static adminInvalidFilterCondition(details?: Record<string, unknown>) {
		return new BusinessException(ErrorCode.ADMIN_1403, details);
	}

	// =========================================================================
	// 문의 (Inquiry)
	// =========================================================================
	static inquiryEmailFailed(details?: unknown) {
		return new BusinessException(ErrorCode.INQUIRY_1501, details);
	}

	// =========================================================================
	// 구독 (Subscription)
	// =========================================================================
	static webhookSignatureInvalid() {
		return new BusinessException(ErrorCode.SUBSCRIPTION_1601);
	}

	static subscriptionUserNotFound(appUserId: string) {
		return new BusinessException(ErrorCode.SUBSCRIPTION_1602, { appUserId });
	}

	static unknownWebhookEventType(eventType: string) {
		return new BusinessException(ErrorCode.SUBSCRIPTION_1603, { eventType });
	}

	static webhookProcessingFailed(details?: unknown) {
		return new BusinessException(ErrorCode.SUBSCRIPTION_1604, details);
	}

	static webhookLockContention(appUserId: string) {
		return new BusinessException(ErrorCode.SUBSCRIPTION_1605, { appUserId });
	}

	// =========================================================================
	// 설정 (Preference)
	// =========================================================================
	static reminderPremiumRequired() {
		return new BusinessException(ErrorCode.PREFERENCE_1701);
	}

	static reminderHourOutOfRange() {
		return new BusinessException(ErrorCode.PREFERENCE_1702);
	}

	// =========================================================================
	// 주간 달성 (Weekly Achievement)
	// =========================================================================
	static weeklyAchievementNotFound(year: number, week: number) {
		return new BusinessException(ErrorCode.ACHIEVEMENT_1801, { year, week });
	}
}
