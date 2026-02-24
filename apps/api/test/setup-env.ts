/**
 * E2E 테스트용 환경변수 설정
 * Jest가 테스트 파일을 로드하기 전에 실행됨
 */
import "../src/common/date/dayjs.setup";

/**
 * E2E 테스트에서 rate limiting 비활성화
 *
 * @nestjs/throttler v6의 ThrottlerGuard는 APP_GUARD로 등록되어
 * overrideGuard/overrideProvider로 비활성화할 수 없음.
 * 프로토타입 패치가 유일한 방법.
 *
 * @see https://github.com/nestjs/throttler/issues
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ThrottlerGuard } = require("@nestjs/throttler");
ThrottlerGuard.prototype.canActivate = () => true;
process.env.DATABASE_URL =
	process.env.DATABASE_URL ||
	"postgresql://postgres:postgres@localhost:5432/aido_test";
process.env.NODE_ENV = "test";

// JWT 환경변수 (필수 - 최소 32자)
process.env.JWT_SECRET =
	process.env.JWT_SECRET ||
	"test-jwt-secret-for-e2e-minimum-32-characters-long";
process.env.JWT_REFRESH_SECRET =
	process.env.JWT_REFRESH_SECRET ||
	"test-jwt-refresh-secret-for-e2e-min-32-chars";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

// 이메일 환경변수 (테스트에서는 mock 사용)
process.env.EMAIL_FROM = process.env.EMAIL_FROM || "noreply@test.example.com";
process.env.EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "Aido Test";

// Token Encryption
process.env.TOKEN_ENCRYPTION_KEY =
	process.env.TOKEN_ENCRYPTION_KEY ||
	"test-token-encryption-key-for-e2e-min-32-chars";

// Cache 환경변수
process.env.CACHE_TYPE = process.env.CACHE_TYPE || "memory";

// Logger 환경변수
process.env.LOG_LEVEL = process.env.LOG_LEVEL || "silent";

// OAuth 환경변수 (테스트용 가짜 값 - 실제 API 호출은 mock 처리)
process.env.GOOGLE_CLIENT_ID =
	process.env.GOOGLE_CLIENT_ID ||
	"test-google-client-id.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET =
	process.env.GOOGLE_CLIENT_SECRET || "test-google-client-secret";
process.env.GOOGLE_CALLBACK_URL =
	process.env.GOOGLE_CALLBACK_URL ||
	"http://localhost:3000/auth/google/callback";
process.env.APPLE_CLIENT_ID =
	process.env.APPLE_CLIENT_ID || "com.test.example.app";
process.env.KAKAO_CLIENT_ID =
	process.env.KAKAO_CLIENT_ID || "test-kakao-client-id";
process.env.KAKAO_CLIENT_SECRET =
	process.env.KAKAO_CLIENT_SECRET || "test-kakao-client-secret";
process.env.KAKAO_CALLBACK_URL =
	process.env.KAKAO_CALLBACK_URL || "http://localhost:3000/auth/kakao/callback";
process.env.NAVER_CLIENT_ID =
	process.env.NAVER_CLIENT_ID || "test-naver-client-id";
process.env.NAVER_CLIENT_SECRET =
	process.env.NAVER_CLIENT_SECRET || "test-naver-client-secret";
process.env.NAVER_CALLBACK_URL =
	process.env.NAVER_CALLBACK_URL || "http://localhost:3000/auth/naver/callback";
