/**
 * E2E 테스트용 환경변수 설정
 * Jest가 테스트 파일을 로드하기 전에 실행됨
 */
process.env.DATABASE_URL =
	process.env.DATABASE_URL ||
	"postgresql://postgres:postgres@localhost:5432/aido_test";
process.env.NODE_ENV = "test";
