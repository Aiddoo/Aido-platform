/**
 * TestDatabase - 통합 테스트용 DB 헬퍼
 *
 * @description
 * Jest globalSetup이 준비한 관리형 PostgreSQL에 Prisma 연결을 제공합니다.
 * 컨테이너와 migration 수명주기는 이 클래스가 소유하지 않습니다.
 * - Prisma 7+ Driver Adapter 패턴 사용
 */

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../src/generated/prisma/client";
import { assertManagedTestDatabaseEnvironment } from "./managed-test-database";

/** 교착으로 튕긴 TRUNCATE를 다시 시도하는 횟수. */
const TRUNCATE_MAX_ATTEMPTS = 3;

/** 재시도 간격의 기준값. 시도마다 선형으로 늘려 경합이 풀릴 틈을 준다. */
const TRUNCATE_RETRY_BASE_MS = 250;

/** PostgreSQL `deadlock_detected`. 이것만 재시도하고, 나머지 실패는 그대로 올린다. */
const DEADLOCK_DETECTED = "40P01";

function isDeadlock(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code?: unknown }).code === DEADLOCK_DETECTED
	);
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

interface TestDatabaseOptions {
	env?: NodeJS.ProcessEnv;
	createPrismaClient?: (connectionUri: string) => PrismaClient;
}

export class TestDatabase {
	private prisma: PrismaClient | null = null;
	private connectionUri: string | null = null;
	private readonly env: NodeJS.ProcessEnv;
	private readonly createPrismaClient: (connectionUri: string) => PrismaClient;

	constructor(options: TestDatabaseOptions = {}) {
		this.env = options.env ?? process.env;
		this.createPrismaClient =
			options.createPrismaClient ??
			((connectionUri) => {
				const adapter = new PrismaPg({ connectionString: connectionUri });
				return new PrismaClient({ adapter });
			});
	}

	/**
	 * globalSetup이 준비한 PostgreSQL에 Prisma 클라이언트 연결
	 *
	 * @returns PrismaClient 인스턴스
	 */
	async start(): Promise<PrismaClient> {
		if (this.prisma) return this.prisma;

		const { connectionUri } = assertManagedTestDatabaseEnvironment(this.env);
		this.connectionUri = connectionUri;
		this.prisma = this.createPrismaClient(connectionUri);

		await this.prisma.$connect();

		return this.prisma;
	}

	/**
	 * Prisma 클라이언트 반환
	 */
	getPrisma(): PrismaClient {
		if (!this.prisma) {
			throw new Error("TestDatabase not started. Call start() first.");
		}
		return this.prisma;
	}

	/**
	 * 관리형 테스트 DB 연결 URI 반환
	 */
	getConnectionUri(): string {
		if (!this.connectionUri) {
			throw new Error("TestDatabase not started. Call start() first.");
		}
		return this.connectionUri;
	}

	/**
	 * 테스트 데이터 초기화 (모든 테이블 데이터 삭제)
	 */
	async cleanup(): Promise<void> {
		if (!this.prisma) {
			return;
		}

		assertManagedTestDatabaseEnvironment(this.env);
		const tables = await this.prisma.$queryRaw<Array<{ table_name: string }>>`
			SELECT table_name
			FROM information_schema.tables
			WHERE table_schema = 'public'
				AND table_type = 'BASE TABLE'
				AND table_name <> '_prisma_migrations'
			ORDER BY table_name
		`;

		if (tables.length === 0) return;

		const tableList = tables
			.map(({ table_name }) => `"public"."${table_name.replaceAll('"', '""')}"`)
			.join(", ");
		await this.#truncate(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
	}

	/**
	 * TRUNCATE는 대상 테이블에 ACCESS EXCLUSIVE 락을 잡는다. 앞 테스트가 남긴 작업이
	 * 아직 같은 테이블을 쥐고 있으면 교착(40P01)으로 튕길 수 있다 — 드문 경합이지
	 * 설계 결함이 아니므로, 물러섰다 다시 잡는다.
	 *
	 * 시간 상한으로 죽이지 않는 이유: 정상적으로 조금 오래 걸리는 정리까지 함께 죽고,
	 * 실패가 "무엇이 잘못됐는지" 대신 "느렸다"만 말하게 된다.
	 */
	async #truncate(statement: string): Promise<void> {
		const client = this.getPrisma();

		for (let attempt = 1; attempt <= TRUNCATE_MAX_ATTEMPTS; attempt += 1) {
			try {
				await client.$executeRawUnsafe(statement);
				return;
			} catch (error) {
				const isLastAttempt = attempt === TRUNCATE_MAX_ATTEMPTS;
				if (isLastAttempt || !isDeadlock(error)) {
					throw error;
				}
				await delay(TRUNCATE_RETRY_BASE_MS * attempt);
			}
		}
	}

	/**
	 * Prisma 클라이언트 연결 해제
	 */
	async stop(): Promise<void> {
		if (this.prisma) {
			await this.prisma.$disconnect();
			this.prisma = null;
		}
		this.connectionUri = null;
	}
}

/**
 * 테스트에서 사용할 전역 TestDatabase 인스턴스 생성 헬퍼
 */
export const createTestDatabase = () => new TestDatabase();
