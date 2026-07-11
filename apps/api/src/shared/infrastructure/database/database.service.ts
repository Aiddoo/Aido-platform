import {
	Inject,
	Injectable,
	type OnModuleDestroy,
	type OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import type { EnvConfig } from "@/shared/infrastructure/config";

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

		// pg 라이브러리가 connectionString의 sslmode를 파싱할 때 ssl: {} 로 변환하여
		// 명시적 ssl 옵션을 덮어쓰므로, sslmode 파라미터를 제거하고 직접 전달
		const url = new URL(rawUrl);
		const hasSslMode = url.searchParams.has("sslmode");
		url.searchParams.delete("sslmode");

		const adapter = new PrismaPg({
			connectionString: url.toString(),
			// Prisma 7 (node-pg 기반)은 SSL 인증서 검증이 엄격함.
			// RDS는 VPC 내부 전용이므로 rejectUnauthorized: false로 충분.
			// NODE_EXTRA_CA_CERTS는 Prisma CLI(migrate)에서 활용됨.
			...(hasSslMode && { ssl: { rejectUnauthorized: false } }),
		});
		super({ adapter });
	}

	async onModuleInit() {
		await this.$connect();
	}

	async onModuleDestroy() {
		await this.$disconnect();
	}
}
