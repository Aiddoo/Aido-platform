/**
 * Swagger 태그 상수
 *
 * API를 기능별로 분류하여 문서화합니다.
 * - User APIs: 클라이언트 앱에서 사용하는 API
 * - Admin APIs: 관리자/백오피스용 API (추후 확장)
 * - Common APIs: 공통 유틸리티 API
 */
export const SWAGGER_TAGS = {
	// ============================================
	// User APIs (클라이언트 앱용)
	// ============================================

	/** 🔐 인증 - 회원가입, 로그인, 토큰 관리 */
	USER_AUTH: "User - 인증",

	/** 📝 할 일 (레거시) - 기존 Todo 관련 API */
	USER_TODO: "User - Todo",

	/** ✅ 할 일 관리 - Todo CRUD, 완료 처리, 순서 변경 */
	TODOS: "Todos",

	/** 📁 할 일 카테고리 - 카테고리 CRUD, 순서 변경 */
	TODO_CATEGORIES: "Todo Categories",

	/** 👥 팔로우/친구 - 친구 요청, 수락, 친구 목록 관리 */
	FOLLOWS: "Follows",

	/** 📊 일일 달성 - 하루 할 일 완료 현황, 통계 */
	DAILY_COMPLETIONS: "Daily Completions",

	/** 🔔 알림 - 푸시 토큰 등록, 알림 목록 조회, 읽음 처리 */
	NOTIFICATIONS: "Notifications",

	/** 👆 콕 찌르기 - 친구 할 일 콕 찌르기, 쿨다운/제한 관리 */
	NUDGES: "Nudges",

	/** 🎉 응원하기 - 친구 응원 메시지, 쿨다운/제한 관리 */
	CHEERS: "Cheers",

	/** 🤖 AI - 자연어 파싱, 주간/월간 리포트, 반복 제안 */
	AI: "AI",

	/** 📩 문의 - 사용자 문의 접수 */
	INQUIRIES: "Inquiries",

	// ============================================
	// Admin APIs (관리자/백오피스용) - 추후 확장
	// ============================================

	/** 👤 사용자 관리 - 회원 조회, 정지, 삭제 */
	ADMIN_USERS: "Admin - 사용자 관리",

	/** 📢 알림 발송 - 전체/조건부/특정 사용자 알림 발송 */
	ADMIN_NOTIFICATIONS: "Admin - 알림 발송",

	/** ⚙️ 시스템 관리 - 설정, 공지, 점검 */
	ADMIN_SYSTEM: "Admin - 시스템",

	// ============================================
	// Common APIs
	// ============================================

	/** 💓 헬스체크 - 서버 상태 확인 */
	COMMON_HEALTH: "Common - Health",
} as const;

export type SwaggerTag = (typeof SWAGGER_TAGS)[keyof typeof SWAGGER_TAGS];

/**
 * Swagger 태그 상세 설명
 *
 * Swagger UI에서 태그 옆에 표시되는 부연 설명입니다.
 * DocumentBuilder.addTag()에서 사용됩니다.
 */
export const SWAGGER_TAG_DESCRIPTIONS: Record<SwaggerTag, string> = {
	[SWAGGER_TAGS.USER_AUTH]: `사용자 인증 API입니다.

**로그인 방식별 차이점**

| 방식 | 클라이언트 전송 | 서버 엔드포인트 | 특징 |
|------|---------------|----------------|------|
| Apple | idToken (JWT) | POST /auth/apple/callback | 네이티브 인증, 1단계 |
| Google/Kakao/Naver | code (교환코드) | GET /auth/{provider}/start → POST /auth/exchange | 웹 브라우저 인증, 2단계 |
| Email | email + password | POST /auth/login | 직접 입력, 1단계 |

**모바일 플로우**
- Apple: 네이티브 API → idToken 획득 → 서버 직접 전송
- Google/Kakao/Naver: 웹 브라우저 → 딥링크 콜백(code) → exchangeCode로 토큰 교환
- Email: 직접 입력 → 서버 검증

**웹 플로우** (동일)
- Apple/Google/Kakao/Naver: OAuth 리다이렉트 → 콜백 URL에서 code 획득 → exchangeCode
- Email: 직접 입력 → 서버 검증`,

	[SWAGGER_TAGS.USER_TODO]: "레거시 API입니다. Todos 태그를 사용하세요.",

	[SWAGGER_TAGS.TODOS]:
		"할 일 CRUD, 완료 처리, 순서 변경, 친구 할 일 조회 (공개 설정 시)",

	[SWAGGER_TAGS.TODO_CATEGORIES]:
		"카테고리 CRUD, 순서/색상 관리. 회원가입 시 기본 카테고리 2개 자동 생성",

	[SWAGGER_TAGS.FOLLOWS]:
		"친구 요청/수락/거절, 친구 목록 조회. 맞팔 시 친구 관계 성립",

	[SWAGGER_TAGS.DAILY_COMPLETIONS]:
		"일일 할 일 완료율, 주간/월간 통계, 친구 달성 현황",

	[SWAGGER_TAGS.NOTIFICATIONS]:
		"푸시 토큰 등록/해제, 알림 목록 조회, 읽음 처리",

	[SWAGGER_TAGS.NUDGES]:
		"친구 할 일에 콕 찌르기. FREE: 3회/일, 동일 할 일 24시간 쿨다운",

	[SWAGGER_TAGS.CHEERS]:
		"친구에게 응원 메시지. FREE: 3회/일, 동일 사용자 24시간 쿨다운",

	[SWAGGER_TAGS.AI]:
		"자연어 파싱 (스마트 시간 해석), 주간/월간 AI 리포트, 반복 패턴 제안. 리포트/제안은 프리미엄 전용",

	[SWAGGER_TAGS.INQUIRIES]:
		"사용자 문의 접수. 카테고리(버그 신고/기능 요청/기타) + 내용을 관리자 이메일로 발송",

	[SWAGGER_TAGS.ADMIN_USERS]: "관리자용: 회원 조회, 정지, 탈퇴 처리",

	[SWAGGER_TAGS.ADMIN_NOTIFICATIONS]:
		"관리자용: 전체/조건부/특정 사용자 알림 발송. 대상 필터링 지원",

	[SWAGGER_TAGS.ADMIN_SYSTEM]: "관리자용: 앱 설정, 공지사항, 점검 모드",

	[SWAGGER_TAGS.COMMON_HEALTH]: "로드밸런서/모니터링용 서버 상태 확인",
};

/**
 * Swagger HTTP 상태 코드별 기본 설명
 */
export const SWAGGER_DESCRIPTION = {
	SUCCESS_200: "요청이 성공적으로 처리되었습니다",
	CREATED_201: "리소스가 성공적으로 생성되었습니다",
	NO_CONTENT_204: "요청이 성공적으로 처리되었습니다 (응답 본문 없음)",
	BAD_REQUEST_400: "잘못된 요청입니다",
	UNAUTHORIZED_401: "인증이 필요합니다",
	FORBIDDEN_403: "접근 권한이 없습니다",
	NOT_FOUND_404: "리소스를 찾을 수 없습니다",
	CONFLICT_409: "리소스 충돌이 발생했습니다",
	UNPROCESSABLE_ENTITY_422: "요청을 처리할 수 없습니다",
	TOO_MANY_REQUESTS_429: "요청이 너무 많습니다",
	INTERNAL_ERROR_500: "서버 내부 오류가 발생했습니다",
} as const;

export type SwaggerDescription =
	(typeof SWAGGER_DESCRIPTION)[keyof typeof SWAGGER_DESCRIPTION];

/**
 * Swagger 보안 스키마 이름
 */
export const SWAGGER_SECURITY = {
	ACCESS_TOKEN: "access-token",
	REFRESH_TOKEN: "refresh-token",
} as const;

/**
 * 공통 에러 응답에 포함할 HTTP 상태 코드
 */
export const COMMON_ERROR_STATUS_CODES = [400, 500] as const;
