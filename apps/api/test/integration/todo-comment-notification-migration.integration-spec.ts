import { readFileSync } from "node:fs";
import path from "node:path";

import { TestDatabase } from "@test/setup/test-database";

import type { PrismaClient } from "@/generated/prisma/client";

const MIGRATION_PATH = path.resolve(
	__dirname,
	"../../prisma/migrations/20260826090000_remove_todo_comment_notification_deep_link/migration.sql",
);
const FRIEND_INDEX_MIGRATION_PATH = path.resolve(
	__dirname,
	"../../prisma/migrations/20260826110000_index_notification_friend_actor_cleanup/migration.sql",
);
const COMMENT_INDEX_MIGRATION_PATH = path.resolve(
	__dirname,
	"../../prisma/migrations/20260826120000_index_notification_comment_actor_cleanup/migration.sql",
);
const TEST_SCHEMA = `todo_comment_notification_migration_${process.pid}`;

interface NotificationRouteRow {
	id: number;
	actionUrl: string | null;
	metadata: Record<string, unknown> | null;
}

interface QueryPlanRow {
	"QUERY PLAN": string;
}

interface IndexStateRow {
	indexName: string;
	isValid: boolean;
}

describe("Todo 댓글 알림 이동 마이그레이션 (실제 PostgreSQL)", () => {
	let testDatabase: TestDatabase;
	let prisma: PrismaClient;

	beforeAll(async () => {
		testDatabase = new TestDatabase();
		prisma = await testDatabase.start();
		await prisma.$executeRawUnsafe(`CREATE SCHEMA "${TEST_SCHEMA}" AUTHORIZATION CURRENT_USER`);
		await prisma.$executeRawUnsafe(`
			CREATE TABLE "${TEST_SCHEMA}"."Notification" (
				"id" integer PRIMARY KEY,
				"userId" text NOT NULL DEFAULT 'recipient',
				"type" text NOT NULL,
				"actionType" text NOT NULL,
				"actionUrl" text,
				"friendId" text,
				"metadata" jsonb
			)
		`);
		await prisma.$executeRawUnsafe(`
			CREATE TABLE "${TEST_SCHEMA}"."TodoComment" (
				"id" text PRIMARY KEY,
				"authorId" text NOT NULL
			)
		`);
		for (const migrationPath of [FRIEND_INDEX_MIGRATION_PATH, COMMENT_INDEX_MIGRATION_PATH]) {
			const indexMigration = readFileSync(migrationPath, "utf8").replaceAll(
				'"Notification"',
				`"${TEST_SCHEMA}"."Notification"`,
			);
			await prisma.$executeRawUnsafe(indexMigration);
		}
	}, 60_000);

	afterAll(async () => {
		await prisma?.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
		await testDatabase?.stop();
	});

	beforeEach(async () => {
		await prisma.$executeRawUnsafe(
			`TRUNCATE TABLE "${TEST_SCHEMA}"."Notification", "${TEST_SCHEMA}"."TodoComment"`,
		);
	});

	it("기존 댓글 URL을 지우고 구 API가 같은 URL을 다시 쓰는 것을 거부한다", async () => {
		// Given - 댓글 알림과 기존 TODO_SHARED·외부 URL 알림이 함께 저장돼 있다
		await prisma.$executeRawUnsafe(`
			INSERT INTO "${TEST_SCHEMA}"."TodoComment" ("id", "authorId")
			VALUES ('cm1', 'actor-1'), ('cm2', 'actor-2'), ('cm3', 'actor-3')
		`);
		await prisma.$executeRawUnsafe(`
			INSERT INTO "${TEST_SCHEMA}"."Notification"
				("id", "type", "actionType", "actionUrl", "metadata")
			VALUES
				(1, 'TODO_SHARED', 'DEEP_LINK', '/todo/42/comment/cm1', '{"commentId":"cm1","activityKind":"COMMENT"}'),
				(2, 'TODO_SHARED', 'DEEP_LINK', '/feed', '{"source":"share"}'),
				(3, 'TODO_SHARED', 'BROWSER', 'https://aido.app/news', '{"commentId":"cm2","activityKind":"REPLY"}'),
				(4, 'TODO_SHARED', 'DEEP_LINK', NULL, '{"commentId":"cm3","activityKind":"LIKE"}'),
				(5, 'TODO_SHARED', 'DEEP_LINK', NULL, '{"commentId":"missing","activityKind":"COMMENT"}')
		`);
		const migration = readFileSync(MIGRATION_PATH, "utf8")
			.replaceAll('"Notification"', `"${TEST_SCHEMA}"."Notification"`)
			.replaceAll('"TodoComment"', `"${TEST_SCHEMA}"."TodoComment"`);

		// When - 배포 migration으로 DB invariant와 기존 데이터 보정을 함께 적용한다
		await prisma.$executeRawUnsafe(migration);

		// Then - 댓글 DEEP_LINK만 타입 기반 fallback을 사용하고 다른 알림은 보존된다
		const rows = await prisma.$queryRawUnsafe<NotificationRouteRow[]>(`
			SELECT "id", "actionUrl", "metadata"
			FROM "${TEST_SCHEMA}"."Notification"
			ORDER BY "id"
		`);
		expect(rows).toEqual([
			{
				id: 1,
				actionUrl: null,
				metadata: { commentId: "cm1", activityKind: "COMMENT", senderId: "actor-1" },
			},
			{ id: 2, actionUrl: "/feed", metadata: { source: "share" } },
			{
				id: 3,
				actionUrl: "https://aido.app/news",
				metadata: { commentId: "cm2", activityKind: "REPLY", senderId: "actor-2" },
			},
		]);

		await expect(
			prisma.$executeRawUnsafe(`
				INSERT INTO "${TEST_SCHEMA}"."Notification"
					("id", "type", "actionType", "actionUrl", "metadata")
				VALUES
					(6, 'TODO_SHARED', 'DEEP_LINK', '/todo/42/comment/cm6', '{"commentId":"cm6"}')
			`),
		).rejects.toThrow();

		await expect(
			prisma.$executeRawUnsafe(`
				INSERT INTO "${TEST_SCHEMA}"."Notification"
					("id", "type", "actionType", "actionUrl", "metadata")
				VALUES
					(7, 'TODO_SHARED', 'DEEP_LINK', NULL, '{"commentId":"cm7"}')
			`),
		).rejects.toThrow();

		await expect(
			prisma.$executeRawUnsafe(`
				INSERT INTO "${TEST_SCHEMA}"."Notification"
					("id", "type", "actionType", "actionUrl", "metadata")
				VALUES
					(8, 'TODO_SHARED', 'DEEP_LINK', NULL, '{"commentId":"cm8","senderId":"actor-8"}'),
					(9, 'TODO_SHARED', 'DEEP_LINK', '/feed', '{"source":"share"}')
			`),
		).resolves.toBe(2);
	});

	it("NOT VALID 제약을 먼저 공개하고 긴 backfill transaction으로 쓰기를 막지 않는다", () => {
		const migration = readFileSync(MIGRATION_PATH, "utf8");
		const addConstraintAt = migration.indexOf("ADD CONSTRAINT");
		const actorBackfillAt = migration.indexOf('UPDATE "Notification" AS notification');
		const routeBackfillAt = migration.indexOf('UPDATE "Notification"\nSET "actionUrl"');
		const validateAt = migration.indexOf("VALIDATE CONSTRAINT");

		expect(migration).not.toContain("BEGIN;");
		expect(addConstraintAt).toBeGreaterThan(-1);
		expect(actorBackfillAt).toBeGreaterThan(addConstraintAt);
		expect(routeBackfillAt).toBeGreaterThan(actorBackfillAt);
		expect(validateAt).toBeGreaterThan(routeBackfillAt);
	});

	it("cleanup index는 실패한 concurrent build를 재시도에서 숨기지 않는다", () => {
		for (const migrationPath of [FRIEND_INDEX_MIGRATION_PATH, COMMENT_INDEX_MIGRATION_PATH]) {
			const migration = readFileSync(migrationPath, "utf8");
			expect(migration).toContain("CREATE INDEX CONCURRENTLY");
			expect(migration).not.toContain("IF NOT EXISTS");
			expect(migration).not.toContain("BEGIN;");
			expect(migration.match(/CREATE INDEX/g)).toHaveLength(1);
		}
	});

	it("계정 purge의 소셜·댓글 actor 조건이 실제 partial index를 사용한다", async () => {
		await prisma.$executeRawUnsafe(`
			INSERT INTO "${TEST_SCHEMA}"."Notification"
				("id", "type", "actionType", "friendId", "metadata")
			SELECT
				series,
				'SYSTEM_NOTICE',
				'NONE',
				CASE WHEN series = 10000 THEN 'actor-target' END,
				CASE
					WHEN series = 9999 THEN '{"senderId":"actor-target"}'::jsonb
					ELSE '{}'::jsonb
				END
			FROM generate_series(1, 10000) AS series
		`);
		await prisma.$executeRawUnsafe(`ANALYZE "${TEST_SCHEMA}"."Notification"`);

		const friendPlan = await prisma.$queryRawUnsafe<QueryPlanRow[]>(`
			EXPLAIN (COSTS OFF)
			SELECT "userId"
			FROM "${TEST_SCHEMA}"."Notification"
			WHERE "friendId" = 'actor-target'
		`);
		const commentPlan = await prisma.$queryRawUnsafe<QueryPlanRow[]>(`
			EXPLAIN (COSTS OFF)
			SELECT "userId"
			FROM "${TEST_SCHEMA}"."Notification"
			WHERE "metadata"->>'senderId' = 'actor-target'
		`);
		const cleanupPlan = await prisma.$queryRawUnsafe<QueryPlanRow[]>(`
			EXPLAIN (COSTS OFF)
			SELECT "userId"
			FROM "${TEST_SCHEMA}"."Notification"
			WHERE "friendId" = 'actor-target'
				OR "metadata"->>'senderId' = 'actor-target'
		`);
		const indexStates = await prisma.$queryRawUnsafe<IndexStateRow[]>(`
			SELECT
				index_class.relname AS "indexName",
				pg_index.indisvalid AS "isValid"
			FROM pg_index
			JOIN pg_class AS index_class ON index_class.oid = pg_index.indexrelid
			JOIN pg_class AS table_class ON table_class.oid = pg_index.indrelid
			JOIN pg_namespace ON pg_namespace.oid = table_class.relnamespace
			WHERE pg_namespace.nspname = '${TEST_SCHEMA}'
				AND index_class.relname IN (
					'Notification_friend_actor_cleanup_idx',
					'Notification_comment_actor_cleanup_idx'
				)
			ORDER BY index_class.relname
		`);

		expect(friendPlan.map((row) => row["QUERY PLAN"]).join("\n")).toContain(
			"Notification_friend_actor_cleanup_idx",
		);
		expect(commentPlan.map((row) => row["QUERY PLAN"]).join("\n")).toContain(
			"Notification_comment_actor_cleanup_idx",
		);
		const cleanupPlanText = cleanupPlan.map((row) => row["QUERY PLAN"]).join("\n");
		expect(cleanupPlanText).toContain("BitmapOr");
		expect(cleanupPlanText).toContain("Notification_friend_actor_cleanup_idx");
		expect(cleanupPlanText).toContain("Notification_comment_actor_cleanup_idx");
		expect(indexStates).toEqual([
			{ indexName: "Notification_comment_actor_cleanup_idx", isValid: true },
			{ indexName: "Notification_friend_actor_cleanup_idx", isValid: true },
		]);
	});
});
