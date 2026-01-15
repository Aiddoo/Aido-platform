import { Injectable } from "@nestjs/common";

import { DatabaseService } from "@/database";
import type { LoginAttempt, Prisma } from "@/generated/prisma/client";

@Injectable()
export class LoginAttemptRepository {
	constructor(private readonly database: DatabaseService) {}

	/**
	 * 로그인 시도 기록
	 */
	async create(
		data: {
			email: string;
			ipAddress: string;
			userAgent: string;
			success: boolean;
			failureReason?: string;
		},
		tx?: Prisma.TransactionClient,
	): Promise<LoginAttempt> {
		const client = tx ?? this.database;
		return client.loginAttempt.create({
			data: {
				email: data.email,
				ipAddress: data.ipAddress,
				userAgent: data.userAgent,
				success: data.success,
				failureReason: data.failureReason,
			},
		});
	}

	/**
	 * 특정 이메일의 최근 실패 횟수 조회
	 */
	async countRecentFailuresByEmail(
		email: string,
		since: Date,
	): Promise<number> {
		return this.database.loginAttempt.count({
			where: {
				email,
				success: false,
				createdAt: { gte: since },
			},
		});
	}

	/**
	 * 특정 IP의 최근 실패 횟수 조회
	 */
	async countRecentFailuresByIp(
		ipAddress: string,
		since: Date,
	): Promise<number> {
		return this.database.loginAttempt.count({
			where: {
				ipAddress,
				success: false,
				createdAt: { gte: since },
			},
		});
	}

	/**
	 * 이메일의 마지막 성공 시도 조회
	 */
	async findLastSuccessByEmail(email: string): Promise<LoginAttempt | null> {
		return this.database.loginAttempt.findFirst({
			where: {
				email,
				success: true,
			},
			orderBy: { createdAt: "desc" },
		});
	}

	/**
	 * 이메일의 마지막 실패 시도 조회
	 */
	async findLastFailureByEmail(email: string): Promise<LoginAttempt | null> {
		return this.database.loginAttempt.findFirst({
			where: {
				email,
				success: false,
			},
			orderBy: { createdAt: "desc" },
		});
	}

	/**
	 * 이메일의 특정 기간 내 실패 기록 초기화 (성공적 로그인 후)
	 *
	 * 참고: 감사 로그 목적으로 실제 삭제보다 별도 플래그 사용 고려
	 * 현재는 단순히 카운트만 사용하므로 삭제하지 않음
	 */
	async clearRecentFailuresByEmail(
		_email: string,
		_since: Date,
	): Promise<void> {
		// 감사 로그 목적으로 삭제하지 않음
		// 필요시 별도 플래그 추가 가능
	}

	/**
	 * 오래된 기록 정리 (배치 작업용, 30일 보관)
	 */
	async deleteOld(retentionDays = 30): Promise<number> {
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - retentionDays);

		const result = await this.database.loginAttempt.deleteMany({
			where: {
				createdAt: { lt: cutoff },
			},
		});
		return result.count;
	}
}
