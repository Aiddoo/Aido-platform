import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import type { Verification, VerificationType } from "@/generated/prisma/client";
import { now } from "@/shared/domain/date/utils/core";
import { DatabaseService } from "@/shared/infrastructure/database";

@Injectable()
export class VerificationRepository {
	constructor(
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
		// incrementAttempts는 활성 트랜잭션을 우회해야 하므로 베이스 클라이언트를 별도 주입한다.
		private readonly database: DatabaseService,
	) {}

	/** 활성 트랜잭션(없으면 베이스 클라이언트) */
	private get client() {
		return this.txHost.tx;
	}

	async create(data: {
		userId: string;
		type: VerificationType;
		token: string; // SHA-256 해시
		expiresAt: Date;
	}): Promise<Verification> {
		return this.client.verification.create({
			data: {
				userId: data.userId,
				type: data.type,
				token: data.token,
				expiresAt: data.expiresAt,
			},
		});
	}

	async findByToken(tokenHash: string): Promise<Verification | null> {
		return this.client.verification.findUnique({
			where: { token: tokenHash },
		});
	}

	async findLatestByUserIdAndType(
		userId: string,
		type: VerificationType,
	): Promise<Verification | null> {
		return this.client.verification.findFirst({
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
	): Promise<Verification | null> {
		return this.client.verification.findFirst({
			where: {
				userId,
				type,
				usedAt: null,
				expiresAt: { gt: now() },
			},
			orderBy: { createdAt: "desc" },
		});
	}

	async markAsUsed(id: number): Promise<Verification> {
		return this.client.verification.update({
			where: { id },
			data: { usedAt: now() },
		});
	}

	/**
	 * 인증 시도 횟수 증가.
	 *
	 * 브루트포스 보호를 위해 실패 횟수는 항상 영구 저장되어야 하므로, 호출측이 연
	 * 트랜잭션(CLS)에 참여하지 않고 베이스 클라이언트로 독립 커밋한다(롤백 시에도 유지).
	 */
	async incrementAttempts(id: number): Promise<Verification> {
		return this.database.verification.update({
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
	): Promise<Verification | null> {
		// 조건부 업데이트 - 조건 불충족 시 count = 0
		const result = await this.client.verification.updateMany({
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
		return this.client.verification.findUnique({
			where: { token: tokenHash },
		});
	}

	async invalidateAllByUserIdAndType(
		userId: string,
		type: VerificationType,
	): Promise<number> {
		// 만료 시간을 현재 시간으로 설정하여 무효화
		const result = await this.client.verification.updateMany({
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
	): Promise<number> {
		return this.client.verification.count({
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
