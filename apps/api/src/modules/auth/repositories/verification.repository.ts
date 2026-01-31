import { Injectable } from "@nestjs/common";

import { now } from "@/common/date/utils";
import { DatabaseService } from "@/database";
import type {
	Prisma,
	Verification,
	VerificationType,
} from "@/generated/prisma/client";

@Injectable()
export class VerificationRepository {
	constructor(private readonly database: DatabaseService) {}

	async create(
		data: {
			userId: string;
			type: VerificationType;
			token: string; // SHA-256 해시
			expiresAt: Date;
		},
		tx?: Prisma.TransactionClient,
	): Promise<Verification> {
		const client = tx ?? this.database;
		return client.verification.create({
			data: {
				userId: data.userId,
				type: data.type,
				token: data.token,
				expiresAt: data.expiresAt,
			},
		});
	}

	async findByToken(tokenHash: string): Promise<Verification | null> {
		return this.database.verification.findUnique({
			where: { token: tokenHash },
		});
	}

	async findLatestByUserIdAndType(
		userId: string,
		type: VerificationType,
	): Promise<Verification | null> {
		return this.database.verification.findFirst({
			where: {
				userId,
				type,
				usedAt: null, // 미사용
				expiresAt: { gt: now() }, // 유효
			},
			orderBy: { createdAt: "desc" },
		});
	}

	// 시도 횟수 검증은 서비스 레이어에서 수행
	async findValidByUserIdAndType(
		userId: string,
		type: VerificationType,
		tx?: Prisma.TransactionClient,
	): Promise<Verification | null> {
		const client = tx ?? this.database;
		return client.verification.findFirst({
			where: {
				userId,
				type,
				usedAt: null,
				expiresAt: { gt: now() },
			},
			orderBy: { createdAt: "desc" },
		});
	}

	async markAsUsed(
		id: number,
		tx?: Prisma.TransactionClient,
	): Promise<Verification> {
		const client = tx ?? this.database;
		return client.verification.update({
			where: { id },
			data: { usedAt: now() },
		});
	}

	async incrementAttempts(
		id: number,
		tx?: Prisma.TransactionClient,
	): Promise<Verification> {
		const client = tx ?? this.database;
		return client.verification.update({
			where: { id },
			data: { attempts: { increment: 1 } },
		});
	}

	/**
	 * 원자적 인증 사용 처리 (조건부 업데이트)
	 *
	 * 조건:
	 * - 토큰 해시 일치
	 * - 사용자 ID 일치
	 * - 타입 일치
	 * - 미사용 (usedAt === null)
	 * - 만료되지 않음 (expiresAt > now)
	 * - 최대 시도 횟수 미초과
	 *
	 * @returns 조건 충족 시 업데이트된 Verification, 불충족 시 null
	 */
	async markAsUsedAtomic(
		tokenHash: string,
		userId: string,
		type: VerificationType,
		maxAttempts: number,
		tx?: Prisma.TransactionClient,
	): Promise<Verification | null> {
		const client = tx ?? this.database;

		// 조건부 업데이트 - 조건 불충족 시 count = 0
		const result = await client.verification.updateMany({
			where: {
				token: tokenHash,
				userId,
				type,
				usedAt: null,
				expiresAt: { gt: now() },
				attempts: { lt: maxAttempts },
			},
			data: { usedAt: now() },
		});

		if (result.count === 0) {
			return null;
		}

		// 업데이트 성공 시 해당 레코드 반환
		return client.verification.findUnique({
			where: { token: tokenHash },
		});
	}

	async invalidateAllByUserIdAndType(
		userId: string,
		type: VerificationType,
		tx?: Prisma.TransactionClient,
	): Promise<number> {
		const client = tx ?? this.database;
		// 만료 시간을 현재 시간으로 설정하여 무효화
		const result = await client.verification.updateMany({
			where: {
				userId,
				type,
				usedAt: null,
				expiresAt: { gt: now() },
			},
			data: { expiresAt: now() },
		});
		return result.count;
	}

	async countRecentByUserIdAndType(
		userId: string,
		type: VerificationType,
		since: Date,
		tx?: Prisma.TransactionClient,
	): Promise<number> {
		const client = tx ?? this.database;
		return client.verification.count({
			where: {
				userId,
				type,
				createdAt: { gte: since },
			},
		});
	}

	async deleteExpired(): Promise<number> {
		const result = await this.database.verification.deleteMany({
			where: {
				OR: [{ expiresAt: { lt: now() } }, { usedAt: { not: null } }],
			},
		});
		return result.count;
	}
}
