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

	/** 👥 팔로우/친구 - 친구 요청, 수락, 친구 목록 관리 */
	FOLLOWS: "Follows",

	/** 📊 일일 달성 - 하루 할 일 완료 현황, 통계 */
	DAILY_COMPLETIONS: "Daily Completions",

	/** 🔔 알림 - 푸시 토큰 등록, 알림 목록 조회, 읽음 처리 */
	NOTIFICATIONS: "Notifications",

	/** 👆 콕 찌르기 - 친구 할 일 독촉, 쿨다운/제한 관리 */
	NUDGES: "Nudges",

	/** 🎉 응원하기 - 친구 응원 메시지, 쿨다운/제한 관리 */
	CHEERS: "Cheers",

	// ============================================
	// Admin APIs (관리자/백오피스용) - 추후 확장
	// ============================================

	/** 👤 사용자 관리 - 회원 조회, 정지, 삭제 */
	ADMIN_USERS: "Admin - 사용자 관리",

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
	// User APIs
	[SWAGGER_TAGS.USER_AUTH]: `
## 🔐 인증 API

사용자 인증 관련 API입니다.

### 주요 기능
- **소셜 로그인**: Apple, Google, Kakao 소셜 계정으로 로그인
- **토큰 관리**: Access Token 갱신, 로그아웃
- **회원 탈퇴**: 계정 삭제 및 데이터 정리

### 인증 방식
- JWT Bearer Token 사용
- Access Token: 1시간 유효
- Refresh Token: 30일 유효
  `,

	[SWAGGER_TAGS.USER_TODO]: `
## 📝 할 일 API (레거시)

기존 Todo 관련 API입니다. 새로운 구현에서는 Todos 태그를 사용하세요.
  `,

	[SWAGGER_TAGS.TODOS]: `
## ✅ 할 일 관리 API

할 일(Todo) CRUD 및 관리 API입니다.

### 주요 기능
- **생성/조회/수정/삭제**: 할 일 CRUD
- **완료 처리**: 할 일 완료/미완료 토글
- **순서 변경**: 드래그 앤 드롭으로 순서 조정
- **반복 설정**: 매일/매주/매월 반복 할 일

### 권한
- 본인의 할 일만 CRUD 가능
- 친구의 할 일은 조회만 가능 (공개 설정 시)
  `,

	[SWAGGER_TAGS.FOLLOWS]: `
## 👥 팔로우/친구 API

친구 관계 관리 API입니다.

### 친구 관계 정의
- **팔로우**: 일방적 관계 (A→B)
- **친구**: 상호 팔로우 관계 (A↔B)

### 주요 기능
- **팔로우 요청**: 다른 사용자에게 친구 요청
- **요청 수락/거절**: 받은 요청 처리
- **친구 목록**: 현재 친구 목록 조회
- **팔로워/팔로잉**: 단방향 관계 목록

### 제한
- 최대 친구 수: 500명
  `,

	[SWAGGER_TAGS.DAILY_COMPLETIONS]: `
## 📊 일일 달성 API

하루 할 일 완료 현황 및 통계 API입니다.

### 주요 기능
- **일일 현황**: 오늘 할 일 완료율
- **주간/월간 통계**: 기간별 달성 현황
- **친구 현황**: 친구들의 오늘 달성률
- **연속 달성**: 연속 100% 달성 일수

### 집계 기준
- 자정(00:00) 기준으로 일일 집계
- 사용자 타임존 고려 (추후 지원 예정)
  `,

	[SWAGGER_TAGS.NOTIFICATIONS]: `
## 🔔 알림 API

푸시 알림 및 인앱 알림 관리 API입니다.

### 주요 기능
- **푸시 토큰**: Expo Push Token 등록/해제
- **알림 목록**: 받은 알림 조회 (페이지네이션)
- **읽음 처리**: 개별/전체 읽음 처리
- **읽지 않은 수**: 뱃지 표시용 카운트

### 알림 종류
| 종류 | 설명 |
|------|------|
| FOLLOW_NEW | 새 친구 요청 |
| FOLLOW_ACCEPTED | 친구 요청 수락됨 |
| NUDGE_RECEIVED | 콕 찌름 받음 |
| CHEER_RECEIVED | 응원 받음 |
| TODO_REMINDER | 할 일 마감 알림 |
| MORNING_REMINDER | 아침 알림 |
| EVENING_REMINDER | 저녁 알림 |
  `,

	[SWAGGER_TAGS.NUDGES]: `
## 👆 콕 찌르기 API

친구의 할 일을 독촉하는 기능입니다.

### 주요 기능
- **콕 찌르기**: 친구의 특정 할 일에 독촉 보내기
- **받은/보낸 목록**: 콕 찌름 내역 조회
- **제한 정보**: 오늘 남은 횟수 확인
- **쿨다운 확인**: 특정 친구에게 다시 찌를 수 있는 시간

### 제한 정책
| 구독 | 일일 제한 | 쿨다운 |
|------|----------|--------|
| FREE | 10회/일 | 24시간 (동일 할 일) |
| ACTIVE | 무제한 | 24시간 (동일 할 일) |

### 알림
콕 찌르면 상대방에게 푸시 알림이 발송됩니다.
  `,

	[SWAGGER_TAGS.CHEERS]: `
## 🎉 응원하기 API

친구에게 응원 메시지를 보내는 기능입니다.

### 주요 기능
- **응원 보내기**: 친구에게 응원 메시지 전송
- **받은/보낸 목록**: 응원 내역 조회
- **제한 정보**: 오늘 남은 횟수 확인
- **쿨다운 확인**: 특정 친구에게 다시 응원할 수 있는 시간

### 제한 정책
| 구독 | 일일 제한 | 쿨다운 |
|------|----------|--------|
| FREE | 3회/일 | 24시간 (동일 사용자) |
| ACTIVE | 무제한 | 24시간 (동일 사용자) |

### 콕 찌르기와의 차이
- **콕 찌르기**: 특정 할 일에 대한 독촉 (할 일 ID 필요)
- **응원하기**: 친구 자체에 대한 응원 (메시지만)
  `,

	// Admin APIs
	[SWAGGER_TAGS.ADMIN_USERS]: `
## 👤 사용자 관리 API (관리자용)

관리자가 사용자를 관리하는 API입니다.

### 주요 기능
- 회원 목록 조회 및 검색
- 회원 상세 정보 조회
- 회원 정지/정지 해제
- 회원 강제 탈퇴

### 권한
관리자(ADMIN) 역할 필요
  `,

	[SWAGGER_TAGS.ADMIN_SYSTEM]: `
## ⚙️ 시스템 관리 API (관리자용)

시스템 설정 및 운영 관련 API입니다.

### 주요 기능
- 앱 설정 관리
- 공지사항 관리
- 서버 점검 모드

### 권한
관리자(ADMIN) 역할 필요
  `,

	// Common APIs
	[SWAGGER_TAGS.COMMON_HEALTH]: `
## 💓 헬스체크 API

서버 상태 확인용 API입니다.

### 용도
- 로드밸런서 헬스체크
- 모니터링 시스템 연동
- 배포 후 서버 상태 확인

### 응답
- 200 OK: 서버 정상
- 503 Service Unavailable: 서버 점검 중
  `,
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
