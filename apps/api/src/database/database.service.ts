import {
	Injectable,
	type OnModuleDestroy,
	type OnModuleInit,
} from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

@Injectable()
export class DatabaseService
	extends PrismaClient
	implements OnModuleInit, OnModuleDestroy
{
	constructor() {
		const connectionString =
			process.env.DATABASE_URL ||
			"postgresql://postgres:postgres@localhost:5432/aido";

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
