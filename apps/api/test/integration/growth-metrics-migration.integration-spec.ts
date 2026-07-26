import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { TestDatabase } from "@test/setup/test-database";
import { PrismaClient } from "@/generated/prisma/client";

const MIGRATION_PATH = path.resolve(
	__dirname,
	"../../prisma/migrations/20260726000000_optimize_growth_metrics/migration.sql",
);
const TEST_SCHEMA = `growth_migration_${process.pid}`;
const LOCK_TIMEOUT_MS = 250;

interface RelationLock {
	mode: string;
	granted: boolean;
}

function createSingleConnectionClient(connectionString: string): PrismaClient {
	return new PrismaClient({
		adapter: new PrismaPg({ connectionString, max: 1 }),
	});
}

function migrationStatements(): string[] {
	return readFileSync(MIGRATION_PATH, "utf8")
		.split(";")
		.map((statement) => statement.trim())
		.filter((statement) => statement.length > 0);
}

function tableNameFor(statement: string): "User" | "UserActivityDay" {
	const tableName = statement.match(/\bON\s+"([^"]+)"/)?.[1];
	if (tableName === "User" || tableName === "UserActivityDay") {
		return tableName;
	}
	throw new Error(`Unexpected growth metric migration statement: ${statement}`);
}

function insertStatementFor(tableName: "User" | "UserActivityDay"): string {
	return tableName === "User"
		? 'INSERT INTO "User" ("deletedAt", "createdAt") VALUES (NULL, now())'
		: 'INSERT INTO "UserActivityDay" ("firstSeenAt") VALUES (now())';
}

async function waitForRelationLock(
	prisma: PrismaClient,
	ddlPid: number,
	qualifiedTableName: string,
): Promise<RelationLock> {
	const timeoutAt = Date.now() + 2_000;

	while (Date.now() < timeoutAt) {
		const locks = await prisma.$queryRawUnsafe<RelationLock[]>(
			`SELECT mode, granted
			 FROM pg_locks
			 WHERE pid = $1
			   AND relation = to_regclass($2)::oid`,
			ddlPid,
			qualifiedTableName,
		);
		const relationLock = locks[0];
		if (relationLock) return relationLock;
		await new Promise<void>((resolve) => setTimeout(resolve, 10));
	}

	throw new Error(
		`Timed out waiting for migration relation lock: pid=${ddlPid}, table=${qualifiedTableName}`,
	);
}

describe("성장 지표 마이그레이션 (실제 PostgreSQL)", () => {
	let testDatabase: TestDatabase;
	let control: PrismaClient;
	let blocker: PrismaClient;
	let ddl: PrismaClient;
	let writer: PrismaClient;

	beforeAll(async () => {
		testDatabase = new TestDatabase({
			createPrismaClient: createSingleConnectionClient,
		});
		control = await testDatabase.start();
		const connectionString = testDatabase.getConnectionUri();
		blocker = createSingleConnectionClient(connectionString);
		ddl = createSingleConnectionClient(connectionString);
		writer = createSingleConnectionClient(connectionString);
		await Promise.all([blocker.$connect(), ddl.$connect(), writer.$connect()]);

		await control.$executeRawUnsafe(
			`CREATE SCHEMA "${TEST_SCHEMA}"
			 AUTHORIZATION CURRENT_USER`,
		);
		await control.$executeRawUnsafe(
			`CREATE TABLE "${TEST_SCHEMA}"."User" (
				"id" bigserial PRIMARY KEY,
				"deletedAt" timestamptz,
				"createdAt" timestamptz NOT NULL
			)`,
		);
		await control.$executeRawUnsafe(
			`CREATE TABLE "${TEST_SCHEMA}"."UserActivityDay" (
				"id" bigserial PRIMARY KEY,
				"firstSeenAt" timestamptz NOT NULL
			)`,
		);

		for (const client of [blocker, ddl, writer]) {
			await client.$executeRawUnsafe(`SET search_path TO "${TEST_SCHEMA}"`);
		}
		await writer.$executeRawUnsafe(
			`SET lock_timeout TO '${LOCK_TIMEOUT_MS}ms'`,
		);
	}, 60_000);

	afterAll(async () => {
		await control?.$executeRawUnsafe(
			`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`,
		);
		await Promise.all([
			blocker?.$disconnect(),
			ddl?.$disconnect(),
			writer?.$disconnect(),
		]);
		await testDatabase?.stop();
	});

	it.each(migrationStatements())(
		"활성 쓰기와 함께 적용해도 새 쓰기를 막지 않아야 한다: %#",
		async (statement) => {
			// Given - 기존 앱 요청이 쓰기 트랜잭션을 수행 중인 운영 테이블
			const tableName = tableNameFor(statement);
			const insertStatement = insertStatementFor(tableName);
			const qualifiedTableName = `"${TEST_SCHEMA}"."${tableName}"`;
			await blocker.$executeRawUnsafe("BEGIN");
			await blocker.$executeRawUnsafe(insertStatement);
			const ddlBackend = await ddl.$queryRawUnsafe<Array<{ pid: number }>>(
				"SELECT pg_backend_pid()::int AS pid",
			);
			const ddlPid = ddlBackend[0]?.pid;
			if (ddlPid === undefined) {
				throw new Error("Could not identify migration backend");
			}

			// When - migration deploy와 다음 기존 앱 쓰기가 겹친다
			// PrismaPromise is lazy; attaching a continuation starts the DDL before
			// we probe pg_locks and issue the competing write.
			const migration = ddl
				.$executeRawUnsafe(statement)
				.then((affectedRows) => affectedRows);
			let relationLock: RelationLock | undefined;
			let writerError: unknown;
			try {
				relationLock = await waitForRelationLock(
					control,
					ddlPid,
					qualifiedTableName,
				);
				try {
					await writer.$executeRawUnsafe(insertStatement);
				} catch (error) {
					writerError = error;
				}
			} finally {
				await blocker.$executeRawUnsafe("COMMIT");
				await migration;
			}

			// Then - online index lock은 쓰기와 호환되고 새 요청도 timeout 없이 완료된다
			expect(relationLock).toEqual({
				mode: "ShareUpdateExclusiveLock",
				granted: true,
			});
			expect(writerError).toBeUndefined();
		},
	);
});
