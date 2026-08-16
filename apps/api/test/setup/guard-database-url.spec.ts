import { assertDatabaseUrlIsSafe } from "../../scripts/guard-database-url.cjs";

const REMOTE_URL =
	"postgresql://admin:s3cret@aido-db.abc123.ap-northeast-2.rds.amazonaws.com:5432/aido";

describe("DATABASE_URL 문지기", () => {
	describe("허용", () => {
		it.each([
			["로컬", "postgresql://postgres:postgres@localhost:5433/aido"],
			["루프백 IP", "postgresql://postgres:postgres@127.0.0.1:5432/aido"],
			["docker compose 서비스명", "postgresql://postgres:postgres@db:5432/aido"],
			["도커에서 본 호스트", "postgresql://postgres:postgres@host.docker.internal:5432/aido"],
			// prisma generate는 연결하지 않는다. 이미지 빌드 중에도 통과해야 한다.
			["placeholder", "postgresql://placeholder:placeholder@localhost:5432/placeholder"],
		])("%s 는 통과한다", (_label, url) => {
			expect(() => assertDatabaseUrlIsSafe(url, {})).not.toThrow();
		});

		it("의도를 선언하면 원격도 통과한다 — 프로덕션 마이그레이션이 이 경로다", () => {
			expect(() =>
				assertDatabaseUrlIsSafe(REMOTE_URL, { AIDO_ALLOW_REMOTE_DB: "1" }),
			).not.toThrow();
		});
	});

	describe("거부", () => {
		it("원격 데이터베이스를 막는다", () => {
			expect(() => assertDatabaseUrlIsSafe(REMOTE_URL, {})).toThrow(/원격 데이터베이스/);
		});

		it("어디로 가는지 모르면 통과시키지 않는다", () => {
			expect(() => assertDatabaseUrlIsSafe("not-a-url", {})).toThrow(/해석할 수 없어/);
		});

		it.each([
			["빈 문자열", ""],
			["다른 값", "0"],
			["true", "true"],
		])("우회 플래그가 %s 면 여전히 막는다 — 정확히 '1'만 의도로 친다", (_label, value) => {
			expect(() => assertDatabaseUrlIsSafe(REMOTE_URL, { AIDO_ALLOW_REMOTE_DB: value })).toThrow(
				/원격 데이터베이스/,
			);
		});

		it("에러 메시지에 자격증명을 흘리지 않는다", () => {
			expect(() => assertDatabaseUrlIsSafe(REMOTE_URL, {})).toThrow(
				expect.objectContaining({
					message: expect.not.stringContaining("s3cret"),
				}),
			);
		});
	});
});
