import { RELEASED_V1_OPENAPI_CONTRACT } from "./released-v1-openapi-contract";

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
	schemasFingerprint: "6c5ddff698ad39fd7e2f0c432a1c45b70f22d39aa27acd0404ac9f1dfe273421",
	pathsFingerprint: "a48b351d1220db66cd3d89330e0b57cb4de887204e5921d6df22d2041f9c3b47",
} as const;
