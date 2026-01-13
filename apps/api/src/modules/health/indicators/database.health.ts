import { Injectable } from "@nestjs/common";
import {
	HealthIndicatorResult,
	HealthIndicatorService,
} from "@nestjs/terminus";
import { DatabaseService } from "@/database";

/**
 * 데이터베이스 헬스 체크 인디케이터
 */
@Injectable()
export class DatabaseHealthIndicator {
	constructor(
		private readonly database: DatabaseService,
		private readonly healthIndicatorService: HealthIndicatorService,
	) {}

	/**
	 * 데이터베이스 연결 상태 확인
	 */
	async isHealthy(key: string): Promise<HealthIndicatorResult> {
		const indicator = this.healthIndicatorService.check(key);

		try {
			await this.database.$queryRaw`SELECT 1`;
			return indicator.up();
		} catch (error) {
			return indicator.down({ error: (error as Error).message });
		}
	}
}
