/**
 * auth 도메인 타입
 *
 * Prisma 생성 enum(@/generated)에 대한 의존을 도메인 계층에서 끊기 위한
 * 도메인 소유 유니온 타입. Prisma의 해당 enum과 구조적으로 동일한 문자열
 * 유니온이므로 저장소 경계에서 양방향 대입 가능하다(계약 불변).
 */

/** 신원 제공자 — 크레덴셜(이메일) + 소셜 4종 */
export type AccountProvider =
	| "CREDENTIAL"
	| "KAKAO"
	| "APPLE"
	| "GOOGLE"
	| "NAVER";

/** 사용자 계정 상태(라이프사이클) */
export type UserStatus = "ACTIVE" | "LOCKED" | "SUSPENDED" | "PENDING_VERIFY";

/** 이메일/비밀번호 검증 코드 종류 */
export type VerificationType =
	| "EMAIL_VERIFY"
	| "PASSWORD_RESET"
	| "PASSWORD_SETUP";
