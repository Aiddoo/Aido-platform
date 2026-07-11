import { Injectable } from "@nestjs/common";
import type { AccountProvider, UserStatus } from "@/auth/domain/types";
import { AccountRepository } from "@/auth/infrastructure/persistence/account.repository";
import { UserRepository } from "@/auth/infrastructure/persistence/user.repository";
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

/** 프로비저닝 결과 — 호출측이 사용하는 최소 신원 정보 */
export interface ProvisionedUser {
	id: string;
	email: string;
}

/**
 * 신규 사용자 프로비저닝 공통 시퀀스 — 이메일 회원가입과 소셜 신규가입의 수렴점.
 *
 * (1) User 생성 → (2) 계정(크레덴셜/OAuth) 연결 → (3) 프로필 →
 * (4) 약관 동의 → (5) 푸시 설정 기본값 → (6) 기본 카테고리 시딩.
 * 호출측이 연 트랜잭션(CLS)에 참여하며, 보안 로그·이메일 인증 코드 발급·세션 발급 등
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

	async execute(input: ProvisionUserInput): Promise<ProvisionedUser> {
		const user = await this.userRepository.create({
			email: input.email,
			status: input.status,
			emailVerifiedAt: input.emailVerifiedAt,
		});

		const account = input.account;
		switch (account.kind) {
			case "credential":
				await this.accountRepository.createCredentialAccount(
					user.id,
					account.hashedPassword,
				);
				break;
			case "oauth":
				await this.accountRepository.createOAuthAccount({
					userId: user.id,
					provider: account.provider,
					providerAccountId: account.providerAccountId,
					refreshToken: account.refreshToken,
				});
				break;
		}

		await this.userRepository.createProfile(user.id, input.profile);

		await this.userConsentRepository.create(user.id, input.consent);

		await this.userPreferenceRepository.create(user.id, {
			pushEnabled: true,
			nightPushEnabled: true,
		});

		await this.todoCategoryRepository.createMany(
			DEFAULT_CATEGORIES.map((category) => ({
				userId: user.id,
				name: category.name,
				color: category.color,
				sortOrder: category.sortOrder,
			})),
		);

		return user;
	}
}
