import { Client, Pool } from "pg";

import { TestDatabase } from "#test/setup/test-database";

import operations from "../../prisma/migrations8/app/20261006T1211_native_unique_constraints/ops.json" with { type: "json" };

const schema = `native_constraint_adoption_${process.pid}`;
const table = `"${schema}"."Account"`;
const index = "Account_provider_providerAccountId_key";
const operation = operations.find((entry) => entry.id === `adoptUnique.Account.${index}`);
if (operation === undefined) throw new Error("Native constraint adoption operation missing");
const adoptionSql = operation.execute[0]?.sql.replaceAll('"public".', `"${schema}".`);
if (adoptionSql === undefined) throw new Error("Native constraint adoption SQL missing");

describe("native migration graph의 기존 unique index 전환", () => {
	let database: TestDatabase;
	let pool: Pool;
	beforeAll(async () => {
		database = new TestDatabase();
		await database.start();
		pool = new Pool({ connectionString: database.getConnectionUri() });
		await pool.query(`CREATE SCHEMA "${schema}"`);
	});
	afterAll(async () => {
		await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
		await pool.end();
		await database.stop();
	});
	beforeEach(async () => {
		await pool.query(`DROP TABLE IF EXISTS ${table}`);
		await pool.query(
			`CREATE TABLE ${table} ("id" text PRIMARY KEY, "provider" text NOT NULL, "providerAccountId" text NOT NULL)`,
		);
		await pool.query(
			`CREATE UNIQUE INDEX "${index}" ON ${table} ("provider", "providerAccountId")`,
		);
		await pool.query(`INSERT INTO ${table} VALUES ('existing', 'CREDENTIAL', '기존 사용자')`);
	});
	const readIndex = async () =>
		(
			await pool.query<{ oid: number; indisvalid: boolean }>(
				"SELECT indexrelid::int AS oid, indisvalid FROM pg_index WHERE indexrelid = to_regclass($1)",
				[`"${schema}"."${index}"`],
			)
		).rows;
	it("graph의 모든 unique 전환이 기존 index를 재사용하며 drop·rebuild를 하지 않는다", () => {
		expect(operations).toHaveLength(34);
		for (const entry of operations) {
			expect(entry.execute).toHaveLength(1);
			expect(entry.execute[0]?.sql).toMatch(
				/^ALTER TABLE .* ADD CONSTRAINT .* UNIQUE USING INDEX /,
			);
			expect(entry.execute[0]?.sql).not.toMatch(/DROP|CREATE INDEX|DELETE|TRUNCATE/);
		}
	});
	it("데이터·index OID·중복 거부를 보존하고 ORM upsert용 constraint만 연결한다", async () => {
		const before = await readIndex();
		await pool.query(adoptionSql);
		expect(await readIndex()).toEqual(before);
		expect((await pool.query(`SELECT * FROM ${table}`)).rows).toEqual([
			{ id: "existing", provider: "CREDENTIAL", providerAccountId: "기존 사용자" },
		]);
		await expect(
			pool.query(`INSERT INTO ${table} VALUES ('duplicate', 'CREDENTIAL', '기존 사용자')`),
		).rejects.toMatchObject({ code: "23505", constraint: index });
	});
	it("활성 쓰기로 DDL이 대기하면 제한시간 내 취소되고 기존 데이터와 쓰기를 보존한다", async () => {
		const writer = new Client({ connectionString: database.getConnectionUri() });
		const ddl = new Client({ connectionString: database.getConnectionUri() });
		await Promise.all([writer.connect(), ddl.connect()]);
		const before = await readIndex();
		try {
			await writer.query("BEGIN");
			await writer.query(
				`INSERT INTO ${table} VALUES ('active', 'CREDENTIAL', 'active@example.com')`,
			);
			await ddl.query("BEGIN");
			await ddl.query("SET LOCAL lock_timeout = '250ms'");
			await expect(ddl.query(adoptionSql)).rejects.toMatchObject({ code: "55P03" });
			await ddl.query("ROLLBACK");
			await writer.query(`INSERT INTO ${table} VALUES ('next', 'CREDENTIAL', 'next@example.com')`);
			await writer.query("COMMIT");
			expect(await readIndex()).toEqual(before);
			await pool.query(adoptionSql);
			expect(await readIndex()).toEqual(before);
			expect((await pool.query(`SELECT count(*)::int AS count FROM ${table}`)).rows).toEqual([
				{ count: 3 },
			]);
		} finally {
			await writer.query("ROLLBACK");
			await ddl.query("ROLLBACK");
			await Promise.all([writer.end(), ddl.end()]);
		}
	});
});
