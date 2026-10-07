import { DELETED_COMMENT_AUTHOR } from "#api/shared/domain/system-user";

import baselineOperations from "../../prisma/migrations8/app/20261006T1211_prisma8_baseline/ops.json" with { type: "json" };
import contractJson from "../../src/generated/prisma8/contract.json" with { type: "json" };

describe("댓글 작성자 native migration 불변식", () => {
	it("작성자와 좋아요 FK는 cleanup 누락 시 RESTRICT로 데이터 유실을 차단한다", () => {
		const tables = contractJson.storage.namespaces.public.entries.table;
		expect(tables.TodoComment.foreignKeys).toContainEqual(
			expect.objectContaining({
				name: "TodoComment_authorId_fkey",
				onDelete: "restrict",
				onUpdate: "cascade",
			}),
		);
		expect(tables.TodoCommentLike.foreignKeys).toContainEqual(
			expect.objectContaining({
				name: "TodoCommentLike_userId_fkey",
				onDelete: "restrict",
				onUpdate: "cascade",
			}),
		);
	});
	it("fresh baseline은 잠긴 시스템 작성자를 만들고 로그인 계정 없는 불변식을 검증한다", () => {
		const seed = baselineOperations.find(
			(operation) => operation.id === "seed.deletedCommentAuthor",
		);
		expect(seed).toBeDefined();
		expect(seed).toMatchObject({
			execute: [
				expect.objectContaining({
					params: [
						DELETED_COMMENT_AUTHOR.id,
						DELETED_COMMENT_AUTHOR.email,
						DELETED_COMMENT_AUTHOR.userTag,
					],
					sql: expect.stringContaining('ON CONFLICT ("id") DO NOTHING'),
				}),
			],
			postcheck: [expect.objectContaining({ sql: expect.stringContaining("u.status = 'LOCKED'") })],
		});
		expect(seed?.postcheck?.[0]?.sql).toContain('"Account"');
	});
});
