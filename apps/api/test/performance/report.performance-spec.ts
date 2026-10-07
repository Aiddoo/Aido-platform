import { performance } from "node:perf_hooks";

import { TransactionHost } from "@nestjs-cls/transactional";
import { Test } from "@nestjs/testing";
import { and } from "@prisma/orm-postgres/orm-client";
import postgres from "@prisma/orm-postgres/runtime";
import { Pool } from "pg";

import { assembleAggregatedData } from "#api/ai-report/domain/services/report-aggregation";
import type { AggregateParams } from "#api/ai-report/domain/types";
import { PrismaTodoStatsReader } from "#api/ai-report/infrastructure/persistence/prisma-todo-stats.reader";
import { decodeRecord, encodeCreate } from "#api/shared/infrastructure/database/database-records";
import { databaseDate } from "#api/shared/infrastructure/database/database-values";
import { DatabaseService } from "#api/shared/infrastructure/database/database.service";
import { PostgresPool } from "#api/shared/infrastructure/database/postgres-pool";
import { createDatabaseContext } from "#test/setup/database-context";
import { TestDatabase } from "#test/setup/test-database";

import type { Contract } from "../../src/generated/prisma8/contract.d.js";
import contractJson from "../../src/generated/prisma8/contract.json" with { type: "json" };

/** 수동 측정 전용. 일반 unit/integration/E2E와 CI에는 포함하지 않는다. */
it("같은 PostgreSQL·pool·데이터에서 기존 8쿼리와 준비된 ORM 집계 5쿼리를 교차 측정한다", async () => {
	let pool: Pool | undefined;
	const testDb = new TestDatabase({
		createClient: (connectionUri) => {
			pool = new Pool({ connectionString: connectionUri });
			return postgres<Contract>({ contractJson, pg: pool });
		},
	});
	const prisma = await testDb.start();
	const module = await Test.createTestingModule({
		providers: [
			{ provide: PostgresPool, useValue: { pool } },
			DatabaseService,
			PrismaTodoStatsReader,
			{
				provide: TransactionHost,
				useValue: { tx: createDatabaseContext(prisma), isTransactionActive: () => false },
			},
		],
	}).compile();
	const reader = module.get(PrismaTodoStatsReader);
	const measure = async (fetch: () => Promise<unknown>) => {
		const samples: number[] = [];
		const cpu = process.cpuUsage();
		for (let i = 0; i < 10; i++) {
			const start = performance.now();
			await fetch();
			samples.push(performance.now() - start);
		}
		const elapsedCpu = process.cpuUsage(cpu);
		return { samples, cpuMs: (elapsedCpu.user + elapsedCpu.system) / 1000 };
	};
	const summarize = (rounds: Awaited<ReturnType<typeof measure>>[]) => {
		const samples = rounds.flatMap((round) => round.samples).sort((a, b) => a - b);
		return {
			p50Ms: samples[Math.floor(samples.length * 0.5)],
			p95Ms: samples[Math.floor(samples.length * 0.95)],
			cpuMs: rounds.reduce((total, round) => total + round.cpuMs, 0),
		};
	};
	// 변경 전 8쿼리를 측정 기준으로 고정한다. production에는 포함하지 않는다.
	const baseline = async (params: AggregateParams) => {
		const { userId, startDate, endDate, prevStartDate, prevEndDate } = params;
		const [
			dailyTotalGroups,
			dailyCompletedGroups,
			prevTotalCount,
			prevCompletedCount,
			catTotalGroups,
			catCompletedGroups,
			categories,
			completedTodos,
		] = await Promise.all([
			prisma.orm.public.Todo.where((row) =>
				and(
					row.userId.eq(userId),
					row.startDate.gte(databaseDate(startDate)),
					row.startDate.lt(databaseDate(endDate)),
				),
			)
				.groupBy("startDate")
				.aggregate((aggregate) => ({ count: aggregate.count() }))
				.then((rows) =>
					rows.map((row) => ({ ...decodeRecord("Todo", row), _count: { id: row.count } })),
				),
			prisma.orm.public.Todo.where((row) =>
				and(
					row.userId.eq(userId),
					row.startDate.gte(databaseDate(startDate)),
					row.startDate.lt(databaseDate(endDate)),
					row.completed.eq(true),
				),
			)
				.groupBy("startDate")
				.aggregate((aggregate) => ({ count: aggregate.count() }))
				.then((rows) =>
					rows.map((row) => ({ ...decodeRecord("Todo", row), _count: { id: row.count } })),
				),
			prisma.orm.public.Todo.where((row) =>
				and(
					row.userId.eq(userId),
					row.startDate.gte(databaseDate(prevStartDate)),
					row.startDate.lt(databaseDate(prevEndDate)),
				),
			)
				.aggregate((aggregate) => ({ count: aggregate.count() }))
				.then(({ count }) => count),
			prisma.orm.public.Todo.where((row) =>
				and(
					row.userId.eq(userId),
					row.startDate.gte(databaseDate(prevStartDate)),
					row.startDate.lt(databaseDate(prevEndDate)),
					row.completed.eq(true),
				),
			)
				.aggregate((aggregate) => ({ count: aggregate.count() }))
				.then((row) => row.count),
			prisma.orm.public.Todo.where((row) =>
				and(
					row.userId.eq(userId),
					row.startDate.gte(databaseDate(startDate)),
					row.startDate.lt(databaseDate(endDate)),
				),
			)
				.groupBy("categoryId")
				.aggregate((aggregate) => ({ count: aggregate.count() }))
				.then((rows) =>
					rows.map((row) => ({ ...decodeRecord("Todo", row), _count: { id: row.count } })),
				),
			prisma.orm.public.Todo.where((row) =>
				and(
					row.userId.eq(userId),
					row.startDate.gte(databaseDate(startDate)),
					row.startDate.lt(databaseDate(endDate)),
					row.completed.eq(true),
				),
			)
				.groupBy("categoryId")
				.aggregate((aggregate) => ({ count: aggregate.count() }))
				.then((rows) =>
					rows.map((row) => ({ ...decodeRecord("Todo", row), _count: { id: row.count } })),
				),
			prisma.orm.public.TodoCategory.where((row) => row.userId.eq(userId))
				.select("id", "name", "color")
				.all()
				.then((row) => decodeRecord("TodoCategory", row)),
			prisma.orm.public.Todo.where((row) =>
				and(
					row.userId.eq(userId),
					row.startDate.gte(databaseDate(startDate)),
					row.startDate.lt(databaseDate(endDate)),
					row.completed.eq(true),
					row.completedAt.isNotNull(),
				),
			)
				.select("startDate", "completedAt")
				.all()
				.then((rows) => decodeRecord("Todo", rows)),
		]);
		return {
			dailyTotalGroups,
			dailyCompletedGroups,
			prevTotalCount,
			prevCompletedCount,
			catTotalGroups,
			catCompletedGroups,
			categories,
			completedTodos,
		};
	};
	try {
		for (const count of [1000, 10_000, 100_000]) {
			await testDb.cleanup();
			const user = decodeRecord(
				"User",
				await prisma.orm.public.User.create(
					encodeCreate("User", {
						email: "benchmark@test.aido.app",
						userTag: "BENCH001",
						status: "ACTIVE",
					}),
				),
			);
			const categories = await Promise.all(
				Array.from({ length: 5 }, (_, i) =>
					prisma.orm.public.TodoCategory.create(
						encodeCreate("TodoCategory", {
							userId: user.id,
							name: `category-${i}`,
							color: "#FF0000",
							sortOrder: i,
						}),
					).then((row) => decodeRecord("TodoCategory", row)),
				),
			);
			for (let offset = 0; offset < count; offset += 1000) {
				await prisma.orm.public.Todo.createAndCount(
					Array.from({ length: Math.min(1000, count - offset) }, (_, index) => {
						const i = offset + index;
						const startDate = new Date(Date.UTC(2026, 1, 16 + (i % 14)));
						const category = categories[i % categories.length];
						if (category === undefined) throw new Error("Benchmark category missing");
						return {
							userId: user.id,
							categoryId: category.id,
							title: `todo-${i}`,
							startDate,
							completed: i % 3 !== 0,
							completedAt:
								i % 3 !== 0
									? new Date(startDate.getTime() + (i % 24) * 3600_000 + (i % 3600) * 1000)
									: null,
						};
					}).map((value) => encodeCreate("Todo", value)),
				);
			}
			const params = {
				userId: user.id,
				startDate: new Date("2026-02-23T00:00:00Z"),
				endDate: new Date("2026-03-02T00:00:00Z"),
				prevStartDate: new Date("2026-02-16T00:00:00Z"),
				prevEndDate: new Date("2026-02-23T00:00:00Z"),
				timezone: "Asia/Seoul",
			};
			const legacy = await baseline(params);
			const current = await reader.fetchAggregationInputs(params);
			expect(
				assembleAggregatedData(current, params.startDate, params.endDate, params.timezone),
			).toEqual(assembleAggregatedData(legacy, params.startDate, params.endDate, params.timezone));
			const beforeRounds: Awaited<ReturnType<typeof measure>>[] = [];
			const afterRounds: Awaited<ReturnType<typeof measure>>[] = [];
			for (let warmup = 0; warmup < 5; warmup++) {
				await baseline(params);
				await reader.fetchAggregationInputs(params);
			}
			// 실행 순서와 공유 프로세스의 GC 영향을 줄이도록 6회 교차 측정한다.
			// RSS는 seed·두 client·두 측정의 누적 값이므로 특정 ORM의 사용량으로 표시하지 않는다.
			let sharedPeakRssMiB = process.memoryUsage().rss / 1024 / 1024;
			for (let round = 0; round < 6; round++) {
				const before = async () => beforeRounds.push(await measure(() => baseline(params)));
				const after = async () =>
					afterRounds.push(await measure(() => reader.fetchAggregationInputs(params)));
				if (round % 2 === 0) {
					await before();
					await after();
				} else {
					await after();
					await before();
				}
				sharedPeakRssMiB = Math.max(sharedPeakRssMiB, process.memoryUsage().rss / 1024 / 1024);
			}
			process.stdout.write(
				`${JSON.stringify({ count, before: summarize(beforeRounds), after: summarize(afterRounds), sharedPeakRssMiB, connections: pool?.totalCount })}\n`,
			);
		}
	} finally {
		await module.close();
		await testDb.stop();
		await pool?.end();
	}
}, 180_000);
