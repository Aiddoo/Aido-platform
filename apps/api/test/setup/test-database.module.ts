/**
 * TestDatabaseModule - E2E 테스트용 DatabaseModule 대체
 *
 * @description
 * 테스트 환경에서 DatabaseModule을 대체하여
 * TestDatabaseService를 DatabaseService로 제공합니다.
 */

import { Global, Module } from "@nestjs/common";
import { DatabaseService } from "../../src/database/database.service";
import { TestDatabaseService } from "./test-database.service";

let testDatabaseService: TestDatabaseService | null = null;

/**
 * TestDatabaseModule에서 사용할 TestDatabaseService 인스턴스 설정
 * beforeAll에서 TestDatabase.start() 이후에 호출
 */
export function setTestDatabaseService(service: TestDatabaseService): void {
	testDatabaseService = service;
}

/**
 * TestDatabaseService 인스턴스 초기화
 */
export function clearTestDatabaseService(): void {
	testDatabaseService = null;
}

@Global()
@Module({
	providers: [
		{
			provide: DatabaseService,
			useFactory: () => {
				if (!testDatabaseService) {
					throw new Error(
						"TestDatabaseService not set. Call setTestDatabaseService() before creating the test module.",
					);
				}
				return testDatabaseService;
			},
		},
	],
	exports: [DatabaseService],
})
export class TestDatabaseModule {}
