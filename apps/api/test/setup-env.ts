/**
 * E2E 테스트용 환경변수 설정
 * Jest가 테스트 파일을 로드하기 전에 실행됨
 */
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
process.env.EMAIL_FROM = process.env.EMAIL_FROM || "noreply@test.aido.app";
process.env.EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "Aido Test";
