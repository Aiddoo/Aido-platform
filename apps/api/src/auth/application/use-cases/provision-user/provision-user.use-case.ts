import { Injectable } from "@nestjs/common";
import { AccountRepository } from "@/auth/infrastructure/persistence/account.repository";
import { UserRepository } from "@/auth/infrastructure/persistence/user.repository";
import type {
	AccountProvider,
	User,
	UserStatus,
} from "@/generated/prisma/client";
import type { TransactionClient } from "@/shared/infrastructure/database/prisma.types";
import { DEFAULT_CATEGORIES, TodoCategoryRepository } from "@/todo-category";
import {
	UserConsentRepository,
	UserPreferenceRepository,
} from "@/user-settings";

/** 신원 계정 유형 — 크레덴셜(이메일) 또는 소셜(OAuth) */
export type ProvisionAccount =
	| { kind: "credential"; hashedPassword: string }
	| {
			kind: "oauth";
			provider: AccountProvider;
			providerAccountId: string;
			refreshToken?: string;
	  };

export interface ProvisionUserInput {
	email: string;
	status: UserStatus;
	/** 소셜은 즉시 인증됨(now()), 크레덴셜은 미설정(이메일 인증 대기) */
	emailVerifiedAt?: Date;
	account: ProvisionAccount;
	profile: { name?: string; profileImage?: string };
	consent: {
		termsAgreedAt?: Date;
		privacyAgreedAt?: Date;
		marketingAgreedAt?: Date;
	};
}

/**
 * 신규 사용자 프로비저닝 공통 시퀀스 — 이메일 회원가입과 소셜 신규가입의 수렴점.
 *
 * (1) User 생성 → (2) 계정(크레덴셜/OAuth) 연결 → (3) 프로필 →
 * (4) 약관 동의 → (5) 푸시 설정 기본값 → (6) 기본 카테고리 시딩.
 * 호출측이 연 트랜잭션(tx)에 참여하며, 보안 로그·이메일 인증 코드 발급·세션 발급 등
 * 경로별 처리는 호출측이 담당한다(IssueLoginUseCase와 동일한 범위 규율).
 */
@Injectable()
export class ProvisionUserUseCase {
	constructor(
		private readonly userRepository: UserRepository,
		private readonly accountRepository: AccountRepository,
		private readonly userConsentRepository: UserConsentRepository,
		private readonly userPreferenceRepository: UserPreferenceRepository,
		private readonly todoCategoryRepository: TodoCategoryRepository,
	) {}

	async execute(
		input: ProvisionUserInput,
		tx: TransactionClient,
	): Promise<User> {
		const user = await this.userRepository.create(
			{
				email: input.email,
				status: input.status,
				emailVerifiedAt: input.emailVerifiedAt,
			},
			tx,
		);

		if (input.account.kind === "credential") {
			await this.accountRepository.createCredentialAccount(
				user.id,
				input.account.hashedPassword,
				tx,
			);
		} else {
			await this.accountRepository.createOAuthAccount(
				{
					userId: user.id,
					provider: input.account.provider,
					providerAccountId: input.account.providerAccountId,
					refreshToken: input.account.refreshToken,
				},
				tx,
			);
		}

		await this.userRepository.createProfile(user.id, input.profile, tx);

		await this.userConsentRepository.create(user.id, input.consent, tx);

		await this.userPreferenceRepository.create(
			user.id,
			{ pushEnabled: true, nightPushEnabled: true },
			tx,
		);

		await this.todoCategoryRepository.createMany(
			DEFAULT_CATEGORIES.map((category) => ({
				userId: user.id,
				name: category.name,
				color: category.color,
				sortOrder: category.sortOrder,
			})),
			tx,
		);

		return user;
	}
}
