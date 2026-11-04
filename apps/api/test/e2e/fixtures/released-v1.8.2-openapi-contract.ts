import { RELEASED_V1_OPENAPI_CONTRACT } from "./released-v1-openapi-contract.js";

/**
 * App Store와 Play Store에 배포된 1.8.2 앱이 출시될 때의 서버 계약입니다.
 *
 * 1.7.x 이후 추가된 surface만 아래에 명시하고, 공통 surface는 이전 fixture에서
 * 상속합니다. 원본 fingerprint는 버전 범프 커밋의 runtime OpenAPI 문서에서 생성하고,
 * 현재 gate fingerprint에는 아래에 기록한 호환 가능한 계약 진화만 반영합니다.
 */
export const RELEASED_V1_8_2_OPENAPI_CONTRACT = {
	releasedClientVersion: "1.8.2",
	sourceCommit: "d8dc87cd2847714039289970f7fe55d34a4b3f51",
	schemaNames: [
		...RELEASED_V1_OPENAPI_CONTRACT.schemaNames,
		"FeatureDiscoveryDisabledResponseDto",
		"FeatureDiscoveryEnabledResponseDto",
		"GrowthSummaryResponseDto",
	].toSorted(),
	pathNames: [
		...RELEASED_V1_OPENAPI_CONTRACT.pathNames,
		"/admin/growth/summary",
		"/app-config/feature-discovery",
	].toSorted(),
	/** 버전 범프 커밋에서 직접 생성한 원본 fingerprint. 아래의 검토 이력을 감사할 때 쓴다. */
	sourceSchemasFingerprint: "a70992dddaa6e92acea5eb99bed5c4155436e5b7a8fc0198b3ff599274b92b88",
	/**
	 * 검토된 계약 진화:
	 * - 2026-08-15 Todo 응답에 commentCount 추가. 1.8.2의 Zod object는 기본 strip
	 *   모드라 알지 못하는 응답 키를 버리므로 기존 화면과 파싱에는 영향이 없습니다.
	 */
	/** 1.10.1: 선택 X-App-Version 헤더와 입력 아이콘 enum 3종만 추가. 구버전 응답은 기존 키로 매핑한다. */
	preProfileIconsSchemasFingerprint:
		"6c5ddff698ad39fd7e2f0c432a1c45b70f22d39aa27acd0404ac9f1dfe273421",
	preProfileIconsPathsFingerprint:
		"a48b351d1220db66cd3d89330e0b57cb4de887204e5921d6df22d2041f9c3b47",
	/** 1.13.0: zod 4.6 업그레이드로 cuid pattern과 union 쿼리 스키마의 JSON Schema 표현만 달라졌다. 라우트·필드·상태 코드는 같다. */
	preZod46SchemasFingerprint: "8bfc508f3e32e9c95b0b980d8faa8834c835059231832b9ff64fd9599aa6574c",
	preZod46PathsFingerprint: "1630f3af64c5944476f7ebdae1517f65dc51cf5b79d031014a13f10a23b79996",
	/** 1.13.0: /me(CurrentUserDto)에 optional premiumSource·premiumEndsAt·premiumPeriodEndsAt·willRenew·bankedPremiumDays·premiumGrantEndedAt만 추가. 구버전 Zod는 strip 모드라 모르는 키를 버린다. */
	prePremiumAccessSchemasFingerprint:
		"0180b22ee884dfb5c5f5d7313ca7f42c1b7d4f41e7aa097ff77f29175b98e64c",
	/** 1.13.0: 문의 요청 category enum에 PAYMENT(결제·구독)만 추가. 구버전 앱은 기존 값만 보내고 서버는 그 값을 그대로 받는다. */
	prePaymentInquirySchemasFingerprint:
		"38740b25738bb2ccfb703aadde140d0a1b4ba71325ea7bf595065acf4491a0a4",
	/** 1.13.0: AI 파싱 응답 meta에 optional promptVersion만 추가. 구버전 Zod는 strip 모드라 모르는 키를 버린다. */
	preAiPromptVersionSchemasFingerprint:
		"8250cd1e76f0475e64fc024cd146199bbe0625dd1f0c43c71d08e1a710b3bf1e",
	/** 1.13.0: parse-memo 응답 meta에 optional omittedTodoCount만 추가. 구버전 Zod는 strip 모드라 모르는 키를 버린다. */
	preMemoOmittedTodoCountSchemasFingerprint:
		"e60ac224071f77495d22aba244893511f8c27ad4b09715d97af23ec501574f45",
	/** 1.13.0: 약관 동의 응답(ConsentResponseDto)에 optional aiDataSharingDecision·aiDataSharingAgreedAt·aiDataSharingConsentVersion만 추가. 구버전 Zod는 strip 모드라 모르는 키를 버린다. */
	preAiDataSharingConsentSchemasFingerprint:
		"75dd9b40d832b9fd34bcddf42d26bd81af7832250fac3146809c2199c289c7ee",
	/** 1.14.0: /me(CurrentUserDto)에 optional isPremium·entitlements만 추가. 구버전 Zod는 strip 모드라 모르는 키를 버린다. */
	prePremiumEntitlementsSchemasFingerprint:
		"29a3b0988b2c0456613124a8f646c378127a224cc7f9922995b7ef500a4cbcec",
	/** 1.15.0: 인증 토큰 응답(AuthTokensDto)에 optional isNewUser만 추가. 소셜 로그인·OAuth 코드 교환에서만 채우고, 구버전 Zod는 strip 모드라 모르는 키를 버린다. */
	preSocialSignupSchemasFingerprint:
		"446c6565975c5d11c8d87238594ccf38995ec10d7dbac109c968fa82c31e63e9",
	/** 1.15.0: AI 파싱 응답(ParseTodoResponseDto·ParseMemoResponseDto)에 optional featureQuota만 추가. 구버전 Zod는 strip 모드라 모르는 키를 버린다. */
	preAiFeatureQuotaSchemasFingerprint:
		"b0f816b4d60b8b4e8e74d15fd9bc41a17e3b3d91ebfe9462961349aaee662fdf",
	/** 1.15.0: 반복 할 일. CreateTodoDto·ConvertMemoToTodoDto 계열에 optional repeat, CreateTodoResponseDto에 optional series, 파싱 응답(ParseTodoResponseDto·ParseMemoResponseDto)에 optional repeat만 추가. 생략하면 동작이 같고 구버전 Zod는 strip 모드라 모르는 키를 버린다. test/e2e/todo-series.e2e-spec.ts가 출시 앱 요청 모양으로 동작을 증명한다. */
	preTodoRepeatSchemasFingerprint:
		"7c9e14a775840b14ccebbab573b36a6c4fb463b13d3e16dc00aa3ab0ad91b8c5",
	/** 1.15.0: 반복 할 일 범위 수정. UpdateTodoDto에 optional scope·repeat·checklist만 추가. 생략하면 THIS_ONLY·변경 없음으로 동작이 같고 구버전 Zod는 strip 모드라 모르는 키를 버린다. */
	preTodoSeriesScopeSchemasFingerprint:
		"b06f5102f3b356b7c9049e6fd4515a6fed0ea53420a7dbd9843d6503759e1bbd",
	schemasFingerprint:
		"9b3c746351caf907307ba9a3f5b1411dc5e1645959f017bdf296429ef0f963b3",
	/** 1.13.0: GET /todos/summary에 선택 date 쿼리(오늘·내일)만 추가. 생략 시 기존 응답과 같아 구버전 앱은 영향이 없다. */
	preTodoSummaryDatePathsFingerprint:
		"dbd292400174ee0cd55f6679b006be195dae5e39fbc1f7dde0e275e13d5bc184",
	/** 1.13.0: parse-todo·parse-memo 429 응답의 error.code를 AI_1303·AI_1310 enum으로 선언했다. 서버는 이미 공급자 요청 과다를 AI_1310(429)로 보내고 있었고 문서만 AI_1303 하나로 덮여 있었다. 응답 shape·상태 코드는 같고, 구버전 앱은 모르는 코드를 서버 message 토스트로 표시한다. */
	preAiRateLimitCodesPathsFingerprint:
		"9dff8baee88ca0c0f180b0d1905baab0285b835752e08cd703f75287b214a70f",
	/** 1.13.0: ApiDoc 공통 400·500이 엔드포인트가 선언한 오류 응답을 덮어 content는 ErrorResponseSchema $ref, 선언한 schema는 content 밖에 떠 있던 문서 결함을 고쳤다. 선언한 상태는 그 오류 코드의 inline schema(같은 success·error·timestamp envelope)로 문서화된다. 실제 응답·상태 코드는 같다. */
	preApiDocCommonErrorsPathsFingerprint:
		"53e916fb7cfc09aa3c8e1d380f08825aa74cec11787f0868bb4c34d5e02d790f",
	/** 1.13.0: 같은 상태 코드의 오류 데코레이터가 겹쳐 하나만 남던 응답(oauth link 401·409, auth 401, todo·todo-category·memo·nudge·follow·admin의 400·404·409)을 error.code enum으로 모두 선언했다. 서버가 보내는 코드·응답 shape·상태 코드는 같고 문서만 빠진 코드를 채웠다. */
	preAllErrorCodesPathsFingerprint:
		"8ab2faa843e1a82bea6d6c1c8f30bd29b94d2addcd0d9757b506ed28ec1cd3a2",
	/** 1.13.0: Zod로 path·query·body를 검증하는 엔드포인트의 400에 입력 검증 실패 SYS_0002를 자동으로 선언했다. 공통 400(ErrorResponseSchema $ref)은 SYS_0002 오류 schema로, 특정 400 코드만 있던 응답은 그 코드와 SYS_0002의 enum으로 바뀐다. 여러 코드 enum은 코드 순으로 정렬한다. 전역 검증 pipe가 이미 보내던 코드라 실제 응답·상태 코드는 같다. */
	preValidationErrorCodePathsFingerprint:
		"1245a17bd4c360e974a16ada61f8fbaaab3444fef779d9338c7b4950b56bf078",
	/** 1.13.0: 원시 값을 받던 path·query를 @aido/api schema로 검증한다. DELETE /auth/sessions/{sessionId}(CUID), DELETE /auth/linked-accounts/{provider}(APPLE·GOOGLE·KAKAO·NAVER), DELETE /notifications/token?deviceId(1-100자), cheers·nudges·nudges/remind cooldown/{userId}(CUID). 배포 앱은 대문자 provider, 등록한 기기 ID, 친구의 CUID만 보내 같은 응답을 받고, 형식이 틀린 입력만 404·500 대신 400 SYS_0002가 된다. */
	preRawInputValidationPathsFingerprint:
		"cc6523a7d1fd2b7620b6fa168fe3096797a55195e05f68bbfe51c70e66598185",
	/** 1.13.0: 차단·신고 추가로 POST /follows/{userTag} 403의 error.code를 BLOCK_2203(차단한 사용자)·FOLLOW_0909(친구 한도) enum으로 선언했다. 응답 shape·상태 코드는 같고, 구버전 앱은 모르는 코드를 서버 message 토스트로 표시한다. */
	preFriendSafetyPathsFingerprint:
		"733aed3fa3ebd0c70664d1461ed6dad9b072ce6aa936f28915b389e98ebf9987",
	/** 1.13.0: AI 할 일·메모 정리 라우트에만 선택 x-app-version 헤더와 403 AI_1311을 추가. 리포트·제안 조회·처리는 그대로다. 헤더가 없거나 1.13.0 미만이면 동의 없이도 기존처럼 처리한다. */
	preAiDataSharingConsentPathsFingerprint:
		"b717111ffbc46d9cbdd8019424d953dac7702ee838605c6e9d6bf4317b7afa4d",
	/** 1.14.0: 날씨 v1을 Swagger에서 Deprecated(태그 `Weather v1 · Deprecated`, operation `deprecated: true`)로 표시했다. 태그·deprecated는 문서 표시용이라 fingerprint에서 description처럼 제외한다. 제외 전 값이 위 sourceCommit 문서와 같았으므로 같은 문서에서 다시 계산한 값이다. 경로·요청·응답·상태 코드는 같다. */
	preDocumentationMetadataPathsFingerprint:
		"e4d5933e1acf6d9839b39f0a1d220c8b33a046af81305306e5ba03cb1fc28369",
	/** 1.15.0: DELETE /todos/{id}에 선택 query scope(생략 시 THIS_ONLY), POST·PATCH·DELETE /todos 오류 응답 enum에 반복 코드(TODO_0813·0841~0846)만 추가. 생략한 요청의 동작·응답 shape는 같고, 구버전 앱은 모르는 코드를 서버 message로 보여 준다. test/e2e/todo-series.e2e-spec.ts가 출시 앱 요청 모양으로 동작을 증명한다. */
	preTodoSeriesScopePathsFingerprint:
		"04721187159f3c02480c9f884ef2227b54067060af59612da5ab31fee46a1f1f",
	pathsFingerprint:
		"a64adcb427027286d5f113734c5e806e4462f38955eb4ae1fbbc446a9796b6d4",
} as const;
