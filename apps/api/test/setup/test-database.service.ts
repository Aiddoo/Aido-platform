/**
 * TestDatabaseService - E2E 테스트용 DatabaseService
 *
 * @description
 * DatabaseService와 동일한 타입을 가지는 테스트용 서비스.
 * NestJS의 overrideProvider를 통해 DatabaseService를 대체합니다.
 *
 * Prisma 7+ Driver Adapter 패턴:
 * - PrismaPg 어댑터 사용
 * - PrismaClient 확장 구조 유지
 *
 * 사용법:
 * ```typescript
 * const testDatabase = new TestDatabase();
 * await testDatabase.start();
 *
 * // E2E 테스트에서 DatabaseService 대체
 * .overrideProvider(DatabaseService)
 * .useValue(testDatabase.getDatabaseService())
 * ```
 */

import {
	Injectable,
	type OnModuleDestroy,
	type OnModuleInit,
} from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";

@Injectable()
export class TestDatabaseService
	extends PrismaClient
	implements OnModuleInit, OnModuleDestroy
{
	constructor(connectionString: string) {
		const adapter = new PrismaPg({ connectionString });
		super({ adapter });
	}

	async onModuleInit() {
		await this.$connect();
	}

	async onModuleDestroy() {
		await this.$disconnect();
	}
}
