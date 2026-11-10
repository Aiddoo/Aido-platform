import { Inject, Injectable } from "@nestjs/common";
import { HealthIndicatorResult, HealthIndicatorService } from "@nestjs/terminus";
import { sql } from "drizzle-orm";

import { type Database, DRIZZLE } from "#api/platform/database/index";

@Injectable()
export class DatabaseHealthIndicator {
  readonly #database: Database;
  readonly #healthIndicatorService: HealthIndicatorService;

  constructor(@Inject(DRIZZLE) database: Database, healthIndicatorService: HealthIndicatorService) {
    this.#database = database;
    this.#healthIndicatorService = healthIndicatorService;
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.#healthIndicatorService.check(key);

    try {
      await this.#database.execute(sql`SELECT 1`);
      return indicator.up();
    } catch (error) {
      return indicator.down({ error: error instanceof Error ? error.message : String(error) });
    }
  }
}
