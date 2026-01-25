import { Injectable } from "@nestjs/common";

import { DatabaseService } from "@/database";
import type { Prisma, UserConsent } from "@/generated/prisma/client";

/**
 * 약관 동의 업데이트 데이터 (최초 동의 시)
 */
export interface CreateConsentData {
	termsAgreedAt?: Date;
	privacyAgreedAt?: Date;
	agreedTermsVersion?: string;
	marketingAgreedAt?: Date | null;
}

/**
 * 마케팅 동의 업데이트 데이터
 */
export interface UpdateMarketingConsentData {
	agreed: boolean;
}

@Injectable()
export class UserConsentRepository {
	constructor(private readonly database: DatabaseService) {}

	/**
	 * 사용자 ID로 약관 동의 상태 조회
	 */
	async findByUserId(
		userId: string,
		tx?: Prisma.TransactionClient,
	): Promise<UserConsent | null> {
		const client = tx ?? this.database;
		return client.userConsent.findUnique({
			where: { userId },
		});
	}

	/**
	 * 약관 동의 레코드 생성 (회원가입 시 사용)
	 */
	async create(
		userId: string,
		data?: Partial<CreateConsentData>,
		tx?: Prisma.TransactionClient,
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

	/**
	 * 약관 동의 업데이트 (없으면 생성)
	 */
	async upsert(
		userId: string,
		data: CreateConsentData,
		tx?: Prisma.TransactionClient,
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

	/**
	 * 마케팅 동의 상태 업데이트
	 * @param agreed true면 현재 시간으로 설정, false면 null로 설정 (철회)
	 */
	async updateMarketingConsent(
		userId: string,
		data: UpdateMarketingConsentData,
		tx?: Prisma.TransactionClient,
	): Promise<UserConsent> {
		const client = tx ?? this.database;
		return client.userConsent.update({
			where: { userId },
			data: {
				marketingAgreedAt: data.agreed ? new Date() : null,
			},
		});
	}

	/**
	 * 마케팅 동의 상태 업데이트 (없으면 생성)
	 */
	async upsertMarketingConsent(
		userId: string,
		data: UpdateMarketingConsentData,
		tx?: Prisma.TransactionClient,
	): Promise<UserConsent> {
		const client = tx ?? this.database;
		const now = new Date();
		return client.userConsent.upsert({
			where: { userId },
			create: {
				userId,
				marketingAgreedAt: data.agreed ? now : null,
			},
			update: {
				marketingAgreedAt: data.agreed ? now : null,
			},
		});
	}
}
