import { Injectable } from "@nestjs/common";
import { HealthIndicatorResult, HealthIndicatorService } from "@nestjs/terminus";
import sql from "sql-template-tag";

import { sqlStatement } from "#api/shared/infrastructure/database/database-sql";
import { DatabaseService } from "#api/shared/infrastructure/database/index";

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
      await this.database.db
        .runtime()
        .execute(
          sqlStatement(this.database.db, sql`SELECT 1`)
            .affectedCount()
            .build(),
        )
        .then((result) => result.affectedRows);
      return indicator.up();
    } catch (error) {
      return indicator.down({ error: (error as Error).message });
    }
  }
}
