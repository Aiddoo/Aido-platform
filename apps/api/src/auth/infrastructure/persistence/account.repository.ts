import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { AuthPersistenceConflict } from "@/auth/application/ports/auth-persistence.port";
import type { Account, AccountProvider } from "@/generated/prisma/client";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { isUniqueConstraintViolation } from "@/shared/infrastructure/database/prisma-error.util";
import { EncryptionService } from "@/shared/infrastructure/encryption";

@Injectable()
export class AccountRepository {
	constructor(
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
		private readonly encryptionService: EncryptionService,
	) {}

	/** 활성 트랜잭션(없으면 베이스 클라이언트) */
	private get client() {
		return this.txHost.tx;
	}

	async findByUserIdAndProvider(
		userId: string,
		provider: AccountProvider,
	): Promise<Account | null> {
		return this.client.account.findUnique({
			where: {
				userId_provider: { userId, provider },
			},
		});
	}

	async findByProviderAccountId(
		provider: AccountProvider,
		providerAccountId: string,
	): Promise<Account | null> {
		return this.client.account.findUnique({
			where: {
				provider_providerAccountId: { provider, providerAccountId },
			},
		});
	}

	async createCredentialAccount(
		userId: string,
		hashedPassword: string,
	): Promise<Account> {
		return this.client.account.create({
			data: {
				userId,
				provider: "CREDENTIAL",
				providerAccountId: userId, // userId를 사용하여 unique constraint 보장
				password: hashedPassword,
			},
		});
	}

	async updatePassword(
		userId: string,
		hashedPassword: string,
	): Promise<Account> {
		return this.client.account.update({
			where: {
				userId_provider: { userId, provider: "CREDENTIAL" },
			},
			data: { password: hashedPassword },
		});
	}

	async createOAuthAccount(data: {
		userId: string;
		provider: AccountProvider;
		providerAccountId: string;
		accessToken?: string;
		refreshToken?: string;
		accessTokenExpiresAt?: Date;
		scope?: string;
	}): Promise<Account> {
		try {
			return await this.client.account.create({
				data: {
					userId: data.userId,
					provider: data.provider,
					providerAccountId: data.providerAccountId,
					accessToken: data.accessToken
						? this.encryptionService.encrypt(data.accessToken)
						: undefined,
					refreshToken: data.refreshToken
						? this.encryptionService.encrypt(data.refreshToken)
						: undefined,
					accessTokenExpiresAt: data.accessTokenExpiresAt,
					scope: data.scope,
				},
			});
		} catch (error) {
			if (isUniqueConstraintViolation(error)) {
				throw new AuthPersistenceConflict("OAUTH_ACCOUNT_ALREADY_LINKED");
			}
			throw error;
		}
	}

	async updateOAuthTokens(
		userId: string,
		provider: AccountProvider,
		tokens: {
			accessToken: string;
			refreshToken?: string;
			accessTokenExpiresAt?: Date;
		},
	): Promise<Account> {
		return this.client.account.update({
			where: {
				userId_provider: { userId, provider },
			},
			data: {
				accessToken: this.encryptionService.encrypt(tokens.accessToken),
				...(tokens.refreshToken && {
					refreshToken: this.encryptionService.encrypt(tokens.refreshToken),
				}),
				...(tokens.accessTokenExpiresAt && {
					accessTokenExpiresAt: tokens.accessTokenExpiresAt,
				}),
			},
		});
	}

	async deleteAccount(
		userId: string,
		provider: AccountProvider,
	): Promise<Account> {
		return this.client.account.delete({
			where: {
				userId_provider: { userId, provider },
			},
		});
	}

	async findAllByUserId(userId: string): Promise<Account[]> {
		return this.client.account.findMany({
			where: { userId },
		});
	}
}
