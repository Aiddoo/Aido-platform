import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool } from "pg";

import type { EnvConfig } from "#api/shared/infrastructure/config/index";

/** PostgreSQL 연결 풀. ORM의 module destroy 뒤 한 번만 종료한다. */
@Injectable()
export class PostgresPool implements OnApplicationShutdown {
	readonly pool: Pool;

	constructor(config: ConfigService<EnvConfig, true>) {
		const url = new URL(config.get("DATABASE_URL", { infer: true }));
		const hasSslMode = url.searchParams.has("sslmode");
		url.searchParams.delete("sslmode");
		this.pool = new Pool({
			connectionString: url.toString(),
			...(hasSslMode && { ssl: { rejectUnauthorized: false } }),
		});
	}

	async onApplicationShutdown() {
		await this.pool.end();
	}
}
