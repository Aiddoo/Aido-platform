/**
 * Store-released 1.7.x clients bundle Zod parsers for this API surface.
 *
 * The names select only the released contract, so additive endpoints/schemas are
 * allowed. Fingerprints come from sourceCommit's runtime OpenAPI document and
 * omit documentation metadata without omitting identically named schema properties.
 */
export const RELEASED_V1_OPENAPI_CONTRACT = {
	releasedClientVersion: "1.7.x",
	sourceCommit: "75cc0e9285958f4963b3adbd8d6a17c631136c91",
	schemaNames: [
		"AcceptFriendRequestResponseDto",
		"AiReportListResponseDto",
		"AiReportResponseDto",
		"AiUsageResponseDto",
		"AppleMobileCallbackDto",
		"AuthTokensDto",
		"BroadcastNotificationDto",
		"BroadcastResultDto",
		"ChangePasswordDto",
		"ChangeTodoCategoryDto",
		"CheerCooldownResponseDto",
		"CheerLimitInfoDto",
		"ConsentResponseDto",
		"ConvertMemoToTodoDto",
		"ConvertMemoToTodoResponseDto",
		"ConvertMemoToTodosDto",
		"ConvertMemoToTodosResponseDto",
		"CreateCheerResponseDto",
		"CreateInquiryDto",
		"CreateInquiryResponseDto",
		"CreateMemoDto",
		"CreateNudgeResponseDto",
		"CreateRecurringTodoDto",
		"CreateRecurringTodoResponseDto",
		"CreateRemindNudgeResponseDto",
		"CreateTodoCategoryDto",
		"CreateTodoCategoryResponseDto",
		"CreateTodoDto",
		"CreateTodoItemDto",
		"CreateTodoResponseDto",
		"CurrentUserDto",
		"DailyCompletionsRangeResponseDto",
		"DeleteAccountDto",
		"DeleteAccountResponseDto",
		"DeleteTodoCategoryResponseDto",
		"DeleteTodoResponseDto",
		"ErrorDetailSchema",
		"ErrorResponseSchema",
		"ExchangeCodeDto",
		"FollowResourceLimitResponseDto",
		"ForgotPasswordDto",
		"FriendsListResponseDto",
		"GoogleMobileCallbackDto",
		"KakaoMobileCallbackDto",
		"LinkSocialAccountDto",
		"LinkedAccountsResponseDto",
		"LocationResponseDto",
		"LoginDto",
		"MarkCheerReadResponseDto",
		"MarkCheersReadDto",
		"MarkNudgeReadResponseDto",
		"MarkReadResponseDto",
		"MarketingPushOptOutDto",
		"MarketingPushOptOutResponseDto",
		"MemoDeleteResponseDto",
		"MemoDetailResponseDto",
		"MemoListResponseDto",
		"MemoMutationResponseDto",
		"MemoResourceLimitResponseDto",
		"MessageResponseDto",
		"NaverMobileCallbackDto",
		"NotificationListResponseDto",
		"NotificationOpenedResponseDto",
		"NudgeCooldownResponseDto",
		"NudgeLimitInfoDto",
		"ParseMemoRequestDto",
		"ParseMemoResponseDto",
		"ParseTodoRequestDto",
		"ParseTodoResponseDto",
		"PreferenceResponseDto",
		"ReceivedCheersResponseDto",
		"ReceivedNudgesResponseDto",
		"ReceivedRequestsResponseDto",
		"RefreshTokensDto",
		"RegisterDto",
		"RegisterPushTokenDto",
		"RegisterTokenResponseDto",
		"RejectFriendRequestResponseDto",
		"RemoveFriendResponseDto",
		"ReorderFriendDto",
		"ReorderFriendResponseDto",
		"ReorderMemoDto",
		"ReorderTodoCategoryDto",
		"ReorderTodoCategoryResponseDto",
		"ReorderTodoDto",
		"ReorderTodoItemsDto",
		"ReorderTodoResponseDto",
		"ReportStatusResponseDto",
		"ResendVerificationDto",
		"ResetPasswordDto",
		"SearchUsersResponseDto",
		"SendCheerDto",
		"SendFriendRequestResponseDto",
		"SendNudgeDto",
		"SendRemindNudgeDto",
		"SentCheersResponseDto",
		"SentNudgesResponseDto",
		"SentRequestsResponseDto",
		"SessionListDto",
		"SetPasswordDto",
		"SuggestionActionDto",
		"SuggestionActionResponseDto",
		"SuggestionListResponseDto",
		"TargetedNotificationDto",
		"TodoCategoryListResponseDto",
		"TodoCategoryResourceLimitResponseDto",
		"TodoCategoryResponseDto",
		"TodoListResponseDto",
		"TodoResourceLimitResponseDto",
		"TodoResponseDto",
		"TodoSummaryResponseDto",
		"ToggleMemoPinDto",
		"ToggleTodoCompleteDto",
		"UnreadCountResponseDto",
		"UpdateLocationDto",
		"UpdateMarketingConsentDto",
		"UpdateMarketingConsentResponseDto",
		"UpdateMarketingPushConsentDto",
		"UpdateMarketingPushConsentResponseDto",
		"UpdateMemoDto",
		"UpdatePreferenceDto",
		"UpdatePreferenceResponseDto",
		"UpdateProfileDto",
		"UpdateProfileResponseDto",
		"UpdateTodoCategoryDto",
		"UpdateTodoCategoryResponseDto",
		"UpdateTodoDto",
		"UpdateTodoItemDto",
		"UpdateTodoResponseDto",
		"UpdateTodoScheduleDto",
		"UpdateTodoTitleDto",
		"UpdateTodoVisibilityDto",
		"VerifyEmailDto",
		"WeatherConditionsResponseDto",
		"WeatherForecastResponseDto",
		"WeeklyAchievementDetailResponseDto",
		"WeeklyAchievementListResponseDto",
	],
	pathNames: [
		"/admin/notifications/broadcast",
		"/admin/notifications/targeted",
		"/ai/parse-memo",
		"/ai/parse-todo",
		"/ai/reports",
		"/ai/reports/status",
		"/ai/reports/{id}",
		"/ai/suggestions",
		"/ai/suggestions/{id}",
		"/ai/usage",
		"/auth/account",
		"/auth/apple/callback",
		"/auth/consent",
		"/auth/consent/marketing",
		"/auth/consent/marketing-push",
		"/auth/exchange",
		"/auth/forgot-password",
		"/auth/google/callback",
		"/auth/google/start",
		"/auth/google/web-callback",
		"/auth/kakao/callback",
		"/auth/kakao/start",
		"/auth/kakao/web-callback",
		"/auth/link",
		"/auth/link-with-code",
		"/auth/linked-accounts",
		"/auth/linked-accounts/{provider}",
		"/auth/login",
		"/auth/logout",
		"/auth/logout-all",
		"/auth/me",
		"/auth/naver/callback",
		"/auth/naver/start",
		"/auth/naver/web-callback",
		"/auth/password",
		"/auth/password/setup-code",
		"/auth/preference",
		"/auth/profile",
		"/auth/refresh",
		"/auth/register",
		"/auth/resend-verification",
		"/auth/reset-password",
		"/auth/sessions",
		"/auth/sessions/{sessionId}",
		"/auth/verify-email",
		"/cheers",
		"/cheers/cooldown/{userId}",
		"/cheers/limit",
		"/cheers/read",
		"/cheers/received",
		"/cheers/sent",
		"/cheers/{id}/read",
		"/daily-completions",
		"/follows/friends",
		"/follows/friends/{followId}/reorder",
		"/follows/requests/received",
		"/follows/requests/sent",
		"/follows/resource-limit",
		"/follows/search",
		"/follows/{userId}",
		"/follows/{userId}/accept",
		"/follows/{userId}/reject",
		"/follows/{userTag}",
		"/health",
		"/inquiries",
		"/memos",
		"/memos/resource-limit",
		"/memos/{id}",
		"/memos/{id}/convert-to-todo",
		"/memos/{id}/convert-to-todos",
		"/memos/{id}/pin",
		"/memos/{id}/reorder",
		"/notifications",
		"/notifications/marketing-push/opt-out",
		"/notifications/read-all",
		"/notifications/token",
		"/notifications/unread-count",
		"/notifications/{id}/opened",
		"/notifications/{id}/read",
		"/nudges",
		"/nudges/cooldown/{userId}",
		"/nudges/limit",
		"/nudges/received",
		"/nudges/remind",
		"/nudges/remind/cooldown/{userId}",
		"/nudges/sent",
		"/nudges/{id}/read",
		"/todo-categories",
		"/todo-categories/resource-limit",
		"/todo-categories/{id}",
		"/todo-categories/{id}/reorder",
		"/todos",
		"/todos/friends/{userId}",
		"/todos/recurring",
		"/todos/resource-limit",
		"/todos/summary",
		"/todos/{id}",
		"/todos/{id}/category",
		"/todos/{id}/complete",
		"/todos/{id}/items",
		"/todos/{id}/items/reorder",
		"/todos/{id}/items/{itemId}",
		"/todos/{id}/reorder",
		"/todos/{id}/schedule",
		"/todos/{id}/title",
		"/todos/{id}/visibility",
		"/weather/conditions",
		"/weather/forecast",
		"/weather/location",
		"/weekly-achievements",
		"/weekly-achievements/{year}/{week}",
	],
	/**
	 * 검토된 계약 진화 (sourceCommit 이후의 의도된 additive 변경):
	 * - 2026-08-15 todoSchema.commentCount 응답 필드 추가 (목록 진입점 뱃지용).
	 *   1.7.x 번들 Zod는 strip 모드라 미지 응답 키를 버린다 — 배포 클라이언트 무영향.
	 */
	/** 1.10.1: 선택 X-App-Version 헤더와 입력 아이콘 enum 3종만 추가. 구버전 응답은 기존 키로 매핑한다. */
	preProfileIconsSchemasFingerprint: "7d54df326aea8812a463f4a7ea5e842fc333c6823276a14e29e58f8a8d3b992b",
	preProfileIconsPathsFingerprint: "ea3b45b70f071294634c39a8523e2683112a02a87f17c1366f279ca7b46e6d8e",
	/** 1.13.0: zod 4.6 업그레이드로 cuid pattern과 union 쿼리 스키마의 JSON Schema 표현만 달라졌다. 라우트·필드·상태 코드는 같다. */
	preZod46SchemasFingerprint:
		"661496b690bb1981dc09130a644d779d135f663e218db04b0dd8724d25eab20e",
	preZod46PathsFingerprint: "12d563b0191e60a54f20cd08208334321e67f67831e3f77cf0d6add48b1f3b22",
	/** 1.13.0: /me(CurrentUserDto)에 optional premiumSource·premiumEndsAt·premiumPeriodEndsAt·willRenew·bankedPremiumDays·premiumGrantEndedAt만 추가. 구버전 Zod는 strip 모드라 모르는 키를 버린다. */
	prePremiumAccessSchemasFingerprint:
		"b6581fa057475468f18183df29e42adadba747271d19630de9a6fa81ca7ab6a7",
	/** 1.13.0: 문의 요청 category enum에 PAYMENT(결제·구독)만 추가. 구버전 앱은 기존 값만 보내고 서버는 그 값을 그대로 받는다. */
	prePaymentInquirySchemasFingerprint:
		"ae2f4dbfd3ce0a76907e35a7ad9011081862d306d24ca4313c6dfafb83c8b724",
	/** 1.13.0: AI 파싱 응답 meta에 optional promptVersion만 추가. 구버전 Zod는 strip 모드라 모르는 키를 버린다. */
	preAiPromptVersionSchemasFingerprint:
		"a09fce15d21a052da513d5296d013ef530cbdbec1eb027d3ad21cf088d872aa9",
	/** 1.13.0: parse-memo 응답 meta에 optional omittedTodoCount만 추가. 구버전 Zod는 strip 모드라 모르는 키를 버린다. */
	preMemoOmittedTodoCountSchemasFingerprint:
		"b16122342ef5475cc9fb6ffbc7a3da96d27830a04d2ae42c284dea792e94dbe7",
	/** 1.13.0: 약관 동의 응답(ConsentResponseDto)에 optional aiDataSharingDecision·aiDataSharingAgreedAt·aiDataSharingConsentVersion만 추가. 구버전 Zod는 strip 모드라 모르는 키를 버린다. */
	preAiDataSharingConsentSchemasFingerprint:
		"8e924ba837a2727c5c6198c3f34d09f8ac3158a88b2de4ec58fc299c8db2c7b4",
	/** 1.14.0: /me(CurrentUserDto)에 optional isPremium·entitlements만 추가. 구버전 Zod는 strip 모드라 모르는 키를 버린다. */
	prePremiumEntitlementsSchemasFingerprint:
		"3e9c8aa0825e84970bd63164bc03cd7be96db5e5b65c9ab4b8d71356a11b347b",
	/** 1.15.0: 인증 토큰 응답(AuthTokensDto)에 optional isNewUser만 추가. 소셜 로그인·OAuth 코드 교환에서만 채우고, 구버전 Zod는 strip 모드라 모르는 키를 버린다. */
	preSocialSignupSchemasFingerprint:
		"f1dc466cac426fe4252f6d06896a74db883035680a27fb6845b33f437f72ba09",
	/** 1.15.0: AI 파싱 응답(ParseTodoResponseDto·ParseMemoResponseDto)에 optional featureQuota만 추가. 구버전 Zod는 strip 모드라 모르는 키를 버린다. */
	preAiFeatureQuotaSchemasFingerprint:
		"18cdee8e6b1dea37c676d7c38a780f47023d21c1a7744e1e2fcfc4ed68de5387",
	/** 1.15.0: 반복 할 일. CreateTodoDto·ConvertMemoToTodoDto 계열에 optional repeat, CreateTodoResponseDto에 optional series, 파싱 응답(ParseTodoResponseDto·ParseMemoResponseDto)에 optional repeat만 추가. 생략하면 동작이 같고 구버전 Zod는 strip 모드라 모르는 키를 버린다. test/e2e/todo-series.e2e-spec.ts가 출시 앱 요청 모양으로 동작을 증명한다. */
	preTodoRepeatSchemasFingerprint:
		"d16b70c92e007e8a74af7072cb7563c6f1868ad27c3f447aec8991c49adf20e1",
	/** 1.15.0: 반복 할 일 범위 수정. UpdateTodoDto에 optional scope·repeat·checklist만 추가. 생략하면 THIS_ONLY·변경 없음으로 동작이 같고 구버전 Zod는 strip 모드라 모르는 키를 버린다. */
	preTodoSeriesScopeSchemasFingerprint:
		"09265fd250a568883c771f60696823e1dea865be4572785410714784fbd74fd6",
	/** 1.15.0: 할 일 목록 반복 정보. 소유자가 보는 할 일 응답(TodoResponseDto·TodoListResponseDto·CreateTodoResponseDto 등 todo를 담은 응답)에 optional repeat·occurrenceDate만 추가했다. 구버전 Zod는 strip 모드라 모르는 키를 버리고, 친구에게 보이는 응답에는 넣지 않는다. test/e2e/todo-list-repeat.e2e-spec.ts가 출시 앱 응답 스키마 파싱으로 증명한다. */
	preTodoListRepeatSchemasFingerprint:
		"3aac5ad1ccef735e82558836423631077517f9017ea1f62906ce6858f2d30544",
	/** 1.15.0: 할 일 응답(소유자·친구·댓글 상세)에 선택 칸 scheduledLocalTime(HH:mm)만 추가. 기존 칸·필수 여부는 같고 출시 앱의 Zod는 strip 모드라 새 키를 버린다. test/e2e/todo-floating-time.e2e-spec.ts가 출시 앱 응답 모양을 고정한다. */
	preFloatingTimeSchemasFingerprint:
		"35ccdb921f3151cb1420e75f83483e115975071ff3a8997fb6af1fbaad4cff0f",
	/** 1.15.0: 메모 나누기 응답(ParseMemoResponseDto)의 할 일에 선택 칸 duplicateOfTodoId만 추가. 기존 칸·필수 여부는 같고 출시 앱의 Zod는 strip 모드라 새 키를 버린다. */
	preMemoDuplicateSchemasFingerprint:
		"203cca850be8bee02f0b729eaef5b539fa6c40d269ec60d6b8204031024980d3",
	/** 1.15.0: 일일 완료 조회 응답에 선택 칸 multiDayTodos만 추가. completions는 전과 같이 시작일에만 세고 출시 앱의 Zod는 strip 모드라 새 키를 버린다. test/e2e/daily-completion.e2e-spec.ts가 출시 앱이 읽는 값을 고정한다. */
	preMultiDayCalendarSchemasFingerprint:
		"61f12446eb24a60db84ac9c7af0fb318abd28d766431c2a20fbaeb4ab3533af4",
	/** 1.15.0: /me(CurrentUserResponseDto)에 선택 칸 premiumIsTrial(스토어 무료 체험 중인지)만 추가. 기존 칸·필수 여부는 같고 출시 앱의 Zod는 strip 모드라 새 키를 버린다. test/e2e/subscription.e2e-spec.ts가 공유 스키마 파싱으로 확인한다. */
	preStoreTrialSchemasFingerprint:
		"808205645551c8b0030137499cddf95e63782645cc6fe9cd9fd27a5cc7052c56",
	/** 1.15.0: 광고성 동의 변경 응답(UpdateMarketingConsentResponseDto·UpdateMarketingPushConsentResponseDto)에 선택 칸 marketingWithdrawnAt·marketingPushWithdrawnAt(철회 처리 서버 시각)만 추가. 기존 칸·필수 여부는 같고 출시 앱의 Zod는 strip 모드라 새 키를 버린다. test/e2e/consent-records.e2e-spec.ts가 공유 스키마 파싱으로 확인한다. */
	preMarketingWithdrawnSchemasFingerprint:
		"0be330447e0fccab4294698ba69a64e4c5418d2ddb4c3f3631199454e813ea88",
	/** 1.15.0: 광고성 푸시 수신 거부 응답(MarketingPushOptOutResponseDto)에 선택 칸 marketingPushWithdrawnAt(요청을 처리한 서버 시각)만 추가. 토큰 유효 여부와 상관없이 항상 줘 유효성을 드러내지 않는다. 기존 칸·필수 여부는 같고 출시 앱의 Zod는 strip 모드라 새 키를 버린다. test/e2e/notification.e2e-spec.ts가 공유 스키마 파싱으로 확인한다. */
	preMarketingPushOptOutProcessedAtSchemasFingerprint:
		"94854f7143e4150eb621cd55280d8f51e7c9329197b97155a2c2baef3cbe1f39",
	/** 1.15.0: /me(CurrentUserResponseDto)에 선택 칸 premiumPlanType(지금 기간을 정하는 스토어 구독의 요금제 ANNUAL·MONTHLY, 모르면 null)만 추가. 기존 칸·필수 여부는 같고 출시 앱의 Zod는 strip 모드라 새 키를 버린다. test/e2e/subscription.e2e-spec.ts가 공유 스키마 파싱으로 확인한다. */
	prePremiumPlanTypeSchemasFingerprint:
		"9884b465b5620978687c2933e8d3e76a6e29987249d441fe999f461d2df29f1b",
	/** 1.15.1: 엔티티 ID를 z.cuid()(format cuid, pattern ^[cC][0-9a-z]{6,}$) 대신 공유 ENTITY_ID_PATTERN(^c[0-9a-z]{8,63}$)으로 검증한다. 서버가 발급한 ID(c + 24 hex, CUID v1 25자, 29자 옛 사용자 ID)는 모두 통과하고 필드·필수 여부·상태 코드는 같다. packages/api/test/entity-id.spec.ts가 출시 앱 요청(세션 해제·관리자 캠페인·대상 사용자 ID)으로 증명한다. */
	preEntityIdPatternSchemasFingerprint:
		"ee973e126a930fb9002180abe69f7985b1cee60191cebcc619b962abdebfa6f7",
	schemasFingerprint:
		"f9cdd86be7d22600eb61ec5d78f38f86cd51e1a369723615896b42741fee34a9",
	/** 1.13.0: GET /todos/summary에 선택 date 쿼리(오늘·내일)만 추가. 생략 시 기존 응답과 같아 구버전 앱은 영향이 없다. */
	preTodoSummaryDatePathsFingerprint:
		"d52736c33c48601fea6473ce56d311e6e49857b7571a532ee943bdc9e3900a1b",
	/** 1.13.0: parse-todo·parse-memo 429 응답의 error.code를 AI_1303·AI_1310 enum으로 선언했다. 서버는 이미 공급자 요청 과다를 AI_1310(429)로 보내고 있었고 문서만 AI_1303 하나로 덮여 있었다. 응답 shape·상태 코드는 같고, 구버전 앱은 모르는 코드를 서버 message 토스트로 표시한다. */
	preAiRateLimitCodesPathsFingerprint:
		"232a008adbbdf9383aeff8f4c29179a123296b70629af0b2baa5b948c50b7f4a",
	/** 1.13.0: ApiDoc 공통 400·500이 엔드포인트가 선언한 오류 응답을 덮어 content는 ErrorResponseSchema $ref, 선언한 schema는 content 밖에 떠 있던 문서 결함을 고쳤다. 선언한 상태는 그 오류 코드의 inline schema(같은 success·error·timestamp envelope)로 문서화된다. 실제 응답·상태 코드는 같다. */
	preApiDocCommonErrorsPathsFingerprint:
		"58f3786d1627480a9402dbb9bcdbf4e456e375f3f66f566644def66dffe1b843",
	/** 1.13.0: 같은 상태 코드의 오류 데코레이터가 겹쳐 하나만 남던 응답(oauth link 401·409, auth 401, todo·todo-category·memo·nudge·follow·admin의 400·404·409)을 error.code enum으로 모두 선언했다. 서버가 보내는 코드·응답 shape·상태 코드는 같고 문서만 빠진 코드를 채웠다. */
	preAllErrorCodesPathsFingerprint:
		"2b9f3e37c745c5f235a0dd952e738b5a64c9f5ffc29246412e5aca24c8f00b71",
	/** 1.13.0: Zod로 path·query·body를 검증하는 엔드포인트의 400에 입력 검증 실패 SYS_0002를 자동으로 선언했다. 공통 400(ErrorResponseSchema $ref)은 SYS_0002 오류 schema로, 특정 400 코드만 있던 응답은 그 코드와 SYS_0002의 enum으로 바뀐다. 여러 코드 enum은 코드 순으로 정렬한다. 전역 검증 pipe가 이미 보내던 코드라 실제 응답·상태 코드는 같다. */
	preValidationErrorCodePathsFingerprint:
		"5a93deaf2d8ffae218c9f896e01878cb8bcc0378e24f4e234ef5894a9f3a884b",
	/** 1.13.0: 원시 값을 받던 path·query를 @aido/api schema로 검증한다. DELETE /auth/sessions/{sessionId}(CUID), DELETE /auth/linked-accounts/{provider}(APPLE·GOOGLE·KAKAO·NAVER), DELETE /notifications/token?deviceId(1-100자), cheers·nudges·nudges/remind cooldown/{userId}(CUID). 배포 앱은 대문자 provider, 등록한 기기 ID, 친구의 CUID만 보내 같은 응답을 받고, 형식이 틀린 입력만 404·500 대신 400 SYS_0002가 된다. */
	preRawInputValidationPathsFingerprint:
		"fabcdf859e45127d31cf8a9a4274561a1d4c83a60f4089cbf128b8f793cecc60",
	/** 1.13.0: 차단·신고 추가로 POST /follows/{userTag} 403의 error.code를 BLOCK_2203(차단한 사용자)·FOLLOW_0909(친구 한도) enum으로 선언했다. 응답 shape·상태 코드는 같고, 구버전 앱은 모르는 코드를 서버 message 토스트로 표시한다. */
	preFriendSafetyPathsFingerprint:
		"91b4fe4e03952e2bb9867293b3fd1946baed7640bcda5c95f2a4e42d94bbca2a",
	/** 1.13.0: AI 할 일·메모 정리 라우트에만 선택 x-app-version 헤더와 403 AI_1311을 추가. 리포트·제안 조회·처리는 그대로다. 헤더가 없거나 1.13.0 미만이면 동의 없이도 기존처럼 처리한다. */
	preAiDataSharingConsentPathsFingerprint:
		"7c517f2efce3afa4832d61055fb28954d8d108c5c5426848532aa4e02f154506",
	/** 1.14.0: 날씨 v1을 Swagger에서 Deprecated(태그 `Weather v1 · Deprecated`, operation `deprecated: true`)로 표시했다. 태그·deprecated는 문서 표시용이라 fingerprint에서 description처럼 제외한다. 제외 전 값이 위 sourceCommit 문서와 같았으므로 같은 문서에서 다시 계산한 값이다. 경로·요청·응답·상태 코드는 같다. */
	preDocumentationMetadataPathsFingerprint:
		"5a0384f8da8af27e97e2607f372d505cae3bffb6be2dc66658af6886adace8a9",
	/** 1.15.0: DELETE /todos/{id}에 선택 query scope(생략 시 THIS_ONLY), POST·PATCH·DELETE /todos 오류 응답에 반복 코드(TODO_0813·0841~0846)와 상태 키를 추가(PATCH에 400·403·409, POST에 400, DELETE에 400). 새 상태는 scope·repeat 같은 새 입력으로만 닿으므로 생략한 요청의 동작·응답 shape는 같고, 구버전 앱은 모르는 코드를 서버 message로 보여 준다. test/e2e/todo-series.e2e-spec.ts가 출시 앱 요청 모양으로 동작을 증명한다. */
	preTodoSeriesScopePathsFingerprint:
		"acaf29b73c6284c5ee7122d51074301477f133fbf57fbfdcb7b532ce75b2ed0b",
	/** 1.15.0: 친구의 할 일 목록(GET /todos/friends/{userId})의 응답 schema 이름만 TodoListResponseDto에서 FriendTodoListResponseDto로 나눴다. 소유자 응답에만 repeat·occurrenceDate를 더하려고 분리했고, 친구 응답의 필드·타입·상태 코드는 이전과 같다. */
	preTodoListRepeatPathsFingerprint:
		"db0449039f7686849cdcbee5ed817a12c90001dcdd3db5bb32b66e2f84cf355d",
	/** 1.15.0: 할 일 응답에 들어가는 선택 칸 scheduledLocalTime과 메모 변환 403 enum에 TODO_0813 추가. 이 경로는 옛 서버도 카테고리 한도로 TODO_0813을 보냈고 문서만 빠져 있었다. 진행 중 반복 300개 상한(옛 경로)도 같은 코드로 거절한다. 응답 shape·상태 코드는 같다. */
	preFloatingTimePathsFingerprint:
		"9809c76e5f1d18f098fed794b83597baac7323d09bd2cf6cc0ec9bd2f52b7e60",
	/** 1.15.0: parse-memo에 선택 Idempotency-Key 헤더만 추가. 생략 시 기존과 같이 요청마다 차감해 출시 앱은 영향이 없다. */
	preMemoIdempotencyPathsFingerprint:
		"873a009001b7bf72246c5a62f5d3d4ba92dc89edeeea9003d7bc559ada98c14d",
	/** 1.15.1: path·query의 엔티티 ID(세션·사용자·팔로우·캠페인)를 같은 ENTITY_ID_PATTERN으로 검증한다. 서버가 발급한 ID는 모두 통과하고 경로·응답·상태 코드는 같다. */
	preEntityIdPatternPathsFingerprint:
		"2a18ce7a5e5781a06d09e3f61be42b73a0b95932ff8dbf0e1e3f79e2070fc930",
	pathsFingerprint:
		"0cd87a71195aea7edbb8f2e16bd449f40fbea6d519947fa076dde204d6698622",
} as const;
