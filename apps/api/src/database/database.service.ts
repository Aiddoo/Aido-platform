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
		const connectionString = configService.get("DATABASE_URL", { infer: true });
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
