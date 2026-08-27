import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DELETED_COMMENT_AUTHOR } from "@/shared/domain/system-user";

const FINALIZE_MIGRATION_PATH = join(
	__dirname,
	"../../prisma/migrations/20260826100000_finalize_todo_conversation/migration.sql",
);

function withoutSqlComments(sql: string): string {
	return sql
		.split("\n")
		.filter((line) => !line.trimStart().startsWith("--"))
		.join("\n")
		.trim();
}

describe("댓글 작성자 FK 마이그레이션", () => {
	it("CASCADE와 RESTRICT 교체 전체를 한 트랜잭션으로 공개한다", () => {
		const migration = withoutSqlComments(readFileSync(FINALIZE_MIGRATION_PATH, "utf8"));

		expect(migration.startsWith("BEGIN;")).toBe(true);
		expect(migration.endsWith("COMMIT;")).toBe(true);
	});

	it("공개 입력으로 만들 수 없는 시스템 식별자와 불변식 검증을 포함한다", () => {
		const migration = readFileSync(FINALIZE_MIGRATION_PATH, "utf8");

		expect(migration).toContain(`'${DELETED_COMMENT_AUTHOR.email}'`);
		expect(migration).toContain(`'${DELETED_COMMENT_AUTHOR.userTag}'`);
		expect(migration).toContain(
			"RAISE EXCEPTION '댓글 삭제 시스템 사용자 불변식을 확인해 주세요.'",
		);
	});
});
