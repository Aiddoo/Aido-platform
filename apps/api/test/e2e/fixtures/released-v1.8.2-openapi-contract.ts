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
	schemasFingerprint:
		"75dd9b40d832b9fd34bcddf42d26bd81af7832250fac3146809c2199c289c7ee",
	/** 1.13.0: GET /todos/summary에 선택 date 쿼리(오늘·내일)만 추가. 생략 시 기존 응답과 같아 구버전 앱은 영향이 없다. */
	pathsFingerprint: "9dff8baee88ca0c0f180b0d1905baab0285b835752e08cd703f75287b214a70f",
} as const;
