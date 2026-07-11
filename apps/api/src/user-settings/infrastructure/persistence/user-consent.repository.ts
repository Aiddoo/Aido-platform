import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import type { UserConsent } from "@/generated/prisma/client";
import { now } from "@/shared/domain/date/utils/core";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import type { UserConsentRepositoryPort } from "../../application/ports/user-consent.repository.port";

export interface CreateConsentData {
	termsAgreedAt?: Date;
	privacyAgreedAt?: Date;
	agreedTermsVersion?: string;
	marketingAgreedAt?: Date | null;
}

export interface UpdateMarketingConsentData {
	agreed: boolean;
}

@Injectable()
export class UserConsentRepository implements UserConsentRepositoryPort {
	constructor(
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
	) {}

	/** 활성 트랜잭션(없으면 베이스 클라이언트) */
	private get client() {
		return this.txHost.tx;
	}

	async findByUserId(userId: string): Promise<UserConsent | null> {
		return this.client.userConsent.findUnique({
			where: { userId },
		});
	}

	async create(
		userId: string,
		data?: Partial<CreateConsentData>,
	): Promise<UserConsent> {
		return this.client.userConsent.create({
			data: {
				userId,
				termsAgreedAt: data?.termsAgreedAt ?? null,
				privacyAgreedAt: data?.privacyAgreedAt ?? null,
				agreedTermsVersion: data?.agreedTermsVersion ?? null,
				marketingAgreedAt: data?.marketingAgreedAt ?? null,
			},
		});
	}

	async upsert(userId: string, data: CreateConsentData): Promise<UserConsent> {
		return this.client.userConsent.upsert({
			where: { userId },
			create: {
				userId,
				termsAgreedAt: data.termsAgreedAt ?? null,
				privacyAgreedAt: data.privacyAgreedAt ?? null,
				agreedTermsVersion: data.agreedTermsVersion ?? null,
				marketingAgreedAt: data.marketingAgreedAt ?? null,
			},
			update: {
				...(data.termsAgreedAt !== undefined && {
					termsAgreedAt: data.termsAgreedAt,
				}),
				...(data.privacyAgreedAt !== undefined && {
					privacyAgreedAt: data.privacyAgreedAt,
				}),
				...(data.agreedTermsVersion !== undefined && {
					agreedTermsVersion: data.agreedTermsVersion,
				}),
				...(data.marketingAgreedAt !== undefined && {
					marketingAgreedAt: data.marketingAgreedAt,
				}),
			},
		});
	}

	// agreed: true면 현재 시간으로 설정, false면 null (철회)
	async updateMarketingConsent(
		userId: string,
		data: UpdateMarketingConsentData,
	): Promise<UserConsent> {
		return this.client.userConsent.update({
			where: { userId },
			data: {
				marketingAgreedAt: data.agreed ? now() : null,
			},
		});
	}

	async upsertMarketingConsent(
		userId: string,
		data: UpdateMarketingConsentData,
	): Promise<UserConsent> {
		return this.client.userConsent.upsert({
			where: { userId },
			create: {
				userId,
				marketingAgreedAt: data.agreed ? now() : null,
			},
			update: {
				marketingAgreedAt: data.agreed ? now() : null,
			},
		});
	}

	/**
	 * 여러 사용자의 동의 정보 배치 조회 (N+1 방지용)
	 */
	async findByUserIds(userIds: string[]): Promise<UserConsent[]> {
		if (userIds.length === 0) return [];
		return this.client.userConsent.findMany({
			where: { userId: { in: userIds } },
		});
	}
}
