import { Injectable } from "@nestjs/common";
import type { TransactionClient } from "@/common/database/prisma.types";
import { now } from "@/common/date/utils/core";
import { DatabaseService } from "@/database";
import type { UserConsent } from "@/generated/prisma/client";

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
export class UserConsentRepository {
	constructor(private readonly database: DatabaseService) {}

	async findByUserId(
		userId: string,
		tx?: TransactionClient,
	): Promise<UserConsent | null> {
		const client = tx ?? this.database;
		return client.userConsent.findUnique({
			where: { userId },
		});
	}

	async create(
		userId: string,
		data?: Partial<CreateConsentData>,
		tx?: TransactionClient,
	): Promise<UserConsent> {
		const client = tx ?? this.database;
		return client.userConsent.create({
			data: {
				userId,
				termsAgreedAt: data?.termsAgreedAt ?? null,
				privacyAgreedAt: data?.privacyAgreedAt ?? null,
				agreedTermsVersion: data?.agreedTermsVersion ?? null,
				marketingAgreedAt: data?.marketingAgreedAt ?? null,
			},
		});
	}

	async upsert(
		userId: string,
		data: CreateConsentData,
		tx?: TransactionClient,
	): Promise<UserConsent> {
		const client = tx ?? this.database;
		return client.userConsent.upsert({
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
		tx?: TransactionClient,
	): Promise<UserConsent> {
		const client = tx ?? this.database;
		return client.userConsent.update({
			where: { userId },
			data: {
				marketingAgreedAt: data.agreed ? now() : null,
			},
		});
	}

	async upsertMarketingConsent(
		userId: string,
		data: UpdateMarketingConsentData,
		tx?: TransactionClient,
	): Promise<UserConsent> {
		const client = tx ?? this.database;
		return client.userConsent.upsert({
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
	async findByUserIds(
		userIds: string[],
		tx?: TransactionClient,
	): Promise<UserConsent[]> {
		if (userIds.length === 0) return [];
		const client = tx ?? this.database;
		return client.userConsent.findMany({
			where: { userId: { in: userIds } },
		});
	}
}
