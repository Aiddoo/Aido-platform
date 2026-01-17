import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";

import { now } from "@/common/date/utils";
import { DatabaseService } from "@/database";
import type { Prisma, Session } from "@/generated/prisma/client";

import { AUTH_DEFAULTS } from "../constants/auth.constants";
import type { CreateSessionData } from "../types";

@Injectable()
export class SessionRepository {
	constructor(private readonly database: DatabaseService) {}

	/**
	 * 세션 생성
	 *
	 * refreshTokenHash는 선택적이며, 토큰 생성 후 updateRefreshTokenHash로 업데이트 가능
	 * refreshTokenHash가 없는 경우 unique 제약 조건을 위해 임시 placeholder 해시 사용
	 */
	async create(
		data: CreateSessionData,
		tx?: Prisma.TransactionClient,
	): Promise<Session> {
		const client = tx ?? this.database;

		// refreshTokenHash가 없으면 임시 placeholder 생성 (unique 제약 조건 충족)
		const refreshTokenHash =
			data.refreshTokenHash ?? `pending_${randomUUID().replace(/-/g, "")}`;

		return client.session.create({
			data: {
				userId: data.userId,
				refreshTokenHash,
				tokenFamily: data.tokenFamily,
				tokenVersion: data.tokenVersion,
				deviceFingerprint: data.deviceFingerprint.substring(
					0,
					AUTH_DEFAULTS.MAX_DEVICE_FINGERPRINT_LENGTH,
				),
				userAgent: data.userAgent,
				ipAddress: data.ipAddress,
				expiresAt: data.expiresAt,
			},
		});
	}

	/**
	 * 리프레시 토큰 해시 업데이트 (세션 생성 후 토큰 발급 시)
	 */
	async updateRefreshTokenHash(
		id: string,
		refreshTokenHash: string,
		tx?: Prisma.TransactionClient,
	): Promise<Session> {
		const client = tx ?? this.database;
		return client.session.update({
			where: { id },
			data: { refreshTokenHash },
		});
	}

	/**
	 * ID로 세션 조회
	 */
	async findById(id: string): Promise<Session | null> {
		return this.database.session.findUnique({
			where: { id },
		});
	}

	/**
	 * Refresh Token 해시로 세션 조회
	 */
	async findByRefreshTokenHash(hash: string): Promise<Session | null> {
		return this.database.session.findUnique({
			where: { refreshTokenHash: hash },
		});
	}

	/**
	 * 토큰 패밀리로 세션 조회
	 */
	async findByTokenFamily(tokenFamily: string): Promise<Session | null> {
		return this.database.session.findFirst({
			where: {
				tokenFamily,
				revokedAt: null,
			},
		});
	}

	/**
	 * 사용자의 활성 세션 목록 조회
	 */
	async findActiveByUserId(userId: string): Promise<Session[]> {
		return this.database.session.findMany({
			where: {
				userId,
				revokedAt: null,
				expiresAt: { gt: now() },
			},
			orderBy: { lastUsedAt: "desc" },
		});
	}

	/**
	 * 세션 토큰 로테이션 업데이트 (낙관적 잠금)
	 *
	 * 레이스 컨디션 방지를 위해 expectedTokenVersion을 사용한 조건부 업데이트 수행.
	 * 다른 요청이 먼저 로테이션한 경우 null 반환.
	 *
	 * @returns 성공 시 업데이트된 세션, 버전 불일치 또는 폐기된 세션인 경우 null
	 */
	async rotateToken(
		id: string,
		data: {
			refreshTokenHash: string;
			tokenVersion: number;
			previousTokenHash: string;
			expectedTokenVersion: number; // 낙관적 잠금용
		},
		tx?: Prisma.TransactionClient,
	): Promise<Session | null> {
		const client = tx ?? this.database;

		// 조건부 업데이트 - 버전 불일치 또는 폐기된 세션이면 count = 0
		const result = await client.session.updateMany({
			where: {
				id,
				tokenVersion: data.expectedTokenVersion,
				revokedAt: null,
			},
			data: {
				refreshTokenHash: data.refreshTokenHash,
				tokenVersion: data.tokenVersion,
				previousTokenHash: data.previousTokenHash,
				lastUsedAt: now(),
			},
		});

		if (result.count === 0) {
			return null;
		}

		// 업데이트 성공 시 해당 세션 반환
		return client.session.findUnique({ where: { id } });
	}

	/**
	 * 세션 마지막 사용 시간 업데이트
	 */
	async updateLastUsedAt(
		id: string,
		tx?: Prisma.TransactionClient,
	): Promise<void> {
		const client = tx ?? this.database;
		await client.session.update({
			where: { id },
			data: { lastUsedAt: now() },
		});
	}

	/**
	 * 세션 폐기
	 */
	async revoke(
		id: string,
		reason: string,
		tx?: Prisma.TransactionClient,
	): Promise<Session> {
		const client = tx ?? this.database;
		return client.session.update({
			where: { id },
			data: {
				revokedAt: now(),
				revokedReason: reason,
			},
		});
	}

	/**
	 * 토큰 패밀리 전체 폐기 (토큰 재사용 감지 시)
	 */
	async revokeByTokenFamily(
		tokenFamily: string,
		reason: string,
		tx?: Prisma.TransactionClient,
	): Promise<number> {
		const client = tx ?? this.database;
		const result = await client.session.updateMany({
			where: {
				tokenFamily,
				revokedAt: null,
			},
			data: {
				revokedAt: now(),
				revokedReason: reason,
			},
		});
		return result.count;
	}

	/**
	 * 사용자의 모든 세션 폐기 (전체 로그아웃)
	 */
	async revokeAllByUserId(
		userId: string,
		reason: string,
		excludeSessionId?: string,
		tx?: Prisma.TransactionClient,
	): Promise<number> {
		const client = tx ?? this.database;
		const result = await client.session.updateMany({
			where: {
				userId,
				revokedAt: null,
				...(excludeSessionId && { id: { not: excludeSessionId } }),
			},
			data: {
				revokedAt: now(),
				revokedReason: reason,
			},
		});
		return result.count;
	}

	/**
	 * 만료된 세션 정리 (배치 작업용)
	 */
	async deleteExpired(): Promise<number> {
		const result = await this.database.session.deleteMany({
			where: {
				OR: [{ expiresAt: { lt: now() } }, { revokedAt: { not: null } }],
			},
		});
		return result.count;
	}

	/**
	 * 이전 토큰 해시로 세션 조회 (토큰 재사용 감지용)
	 */
	async findByPreviousTokenHash(hash: string): Promise<Session | null> {
		return this.database.session.findFirst({
			where: { previousTokenHash: hash },
		});
	}
}
