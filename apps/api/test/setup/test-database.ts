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
		await this.prisma.$executeRawUnsafe(
			`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`,
		);
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
