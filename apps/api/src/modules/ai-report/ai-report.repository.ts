import { Injectable } from "@nestjs/common";
import type { TransactionClient } from "@/common/database/prisma.types";
import { DatabaseService } from "@/database/database.service";
import type { AiReport, Prisma, ReportType } from "@/generated/prisma/client";
import type { FindReportsParams } from "./types";

/**
 * AI 리포트 리포지토리
 *
 * AI 리포트 데이터의 CRUD 작업을 담당합니다.
 */
@Injectable()
export class AiReportRepository {
	constructor(private readonly database: DatabaseService) {}

	/**
	 * AI 리포트 생성
	 */
	async create(
		data: Prisma.AiReportCreateInput,
		tx?: TransactionClient,
	): Promise<AiReport> {
		const client = tx ?? this.database;
		return client.aiReport.create({ data });
	}

	/**
	 * ID와 사용자 ID로 리포트 조회
	 */
	async findByIdAndUserId(
		id: number,
		userId: string,
		tx?: TransactionClient,
	): Promise<AiReport | null> {
		const client = tx ?? this.database;
		return client.aiReport.findFirst({
			where: { id, userId },
		});
	}

	/**
	 * 최신 리포트 조회 (타입별)
	 */
	async findLatest(
		userId: string,
		type: ReportType,
		tx?: TransactionClient,
	): Promise<AiReport | null> {
		const client = tx ?? this.database;
		return client.aiReport.findFirst({
			where: { userId, type },
			orderBy: { generatedAt: "desc" },
		});
	}

	/**
	 * 리포트 목록 조회
	 */
	async findMany(
		params: FindReportsParams,
		tx?: TransactionClient,
	): Promise<AiReport[]> {
		const client = tx ?? this.database;
		const where: Prisma.AiReportWhereInput = {
			userId: params.userId,
		};

		if (params.type) {
			where.type = params.type;
		}

		return client.aiReport.findMany({
			where,
			orderBy: { generatedAt: "desc" },
			take: params.limit,
		});
	}

	/**
	 * 특정 기간 리포트 존재 여부 확인
	 */
	async exists(
		userId: string,
		type: ReportType,
		year: number,
		period: number,
		tx?: TransactionClient,
	): Promise<boolean> {
		const client = tx ?? this.database;
		const count = await client.aiReport.count({
			where: { userId, type, year, period },
		});
		return count > 0;
	}
}
