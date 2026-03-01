import { existsSync, readFileSync } from "node:fs";
import {
	Inject,
	Injectable,
	type OnModuleDestroy,
	type OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import type { EnvConfig } from "../common/config";
import { PrismaClient } from "../generated/prisma/client";

@Injectable()
export class DatabaseService
	extends PrismaClient
	implements OnModuleInit, OnModuleDestroy
{
	constructor(
		@Inject(ConfigService)
		configService: ConfigService<EnvConfig, true>,
	) {
		const rawUrl = configService.get("DATABASE_URL", { infer: true });

		const caCertPath = process.env.NODE_EXTRA_CA_CERTS;
		if (caCertPath && existsSync(caCertPath)) {
			// pg 라이브러리가 connectionString을 파싱할 때 sslmode → ssl: {} 로 변환하여
			// 명시적 ssl 옵션을 덮어쓰므로, sslmode 파라미터를 제거하고 직접 전달
			const url = new URL(rawUrl);
			url.searchParams.delete("sslmode");
			const adapter = new PrismaPg({
				connectionString: url.toString(),
				ssl: { ca: readFileSync(caCertPath, "utf8") },
			});
			super({ adapter });
		} else {
			const adapter = new PrismaPg({ connectionString: rawUrl });
			super({ adapter });
		}
	}

	async onModuleInit() {
		await this.$connect();
	}

	async onModuleDestroy() {
		await this.$disconnect();
	}
}
