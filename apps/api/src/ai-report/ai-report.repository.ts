import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import type { AiReport, Prisma, ReportType } from "@/generated/prisma/client";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";
import type { FindReportsParams } from "./types";

/**
 * AI 리포트 리포지토리
 *
 * AI 리포트 데이터의 CRUD 작업을 담당합니다.
 *
 * 트랜잭션은 CLS로 전파됩니다 — TransactionHost.tx가 활성 트랜잭션 클라이언트를,
 * 활성 트랜잭션이 없으면 베이스 DatabaseService를 반환합니다.
 */
@Injectable()
export class AiReportRepository {
	constructor(
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
	) {}

	/** 활성 트랜잭션(없으면 베이스 클라이언트) */
	private get client() {
		return this.txHost.tx;
	}

	/**
	 * AI 리포트 생성
	 */
	async create(data: Prisma.AiReportCreateInput): Promise<AiReport> {
		return this.client.aiReport.create({ data });
	}

	/**
	 * ID와 사용자 ID로 리포트 조회
	 */
	async findByIdAndUserId(
		id: number,
		userId: string,
	): Promise<AiReport | null> {
		return this.client.aiReport.findFirst({
			where: { id, userId },
		});
	}

	/**
	 * 최신 리포트 조회 (타입별)
	 */
	async findLatest(userId: string, type: ReportType): Promise<AiReport | null> {
		return this.client.aiReport.findFirst({
			where: { userId, type },
			orderBy: { generatedAt: "desc" },
		});
	}

	/**
	 * 리포트 목록 조회
	 */
	async findMany(params: FindReportsParams): Promise<AiReport[]> {
		const where: Prisma.AiReportWhereInput = {
			userId: params.userId,
		};

		if (params.type) {
			where.type = params.type;
		}

		return this.client.aiReport.findMany({
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
	): Promise<boolean> {
		const count = await this.client.aiReport.count({
			where: { userId, type, year, period },
		});
		return count > 0;
	}
}
