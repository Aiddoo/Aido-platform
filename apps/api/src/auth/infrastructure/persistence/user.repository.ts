import { ErrorCode } from "@aido/errors";
import { Injectable, Logger } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { generateUserTag } from "@/auth/domain/services/user-tag.util";
import type {
	AccountProvider,
	Prisma,
	SubscriptionStatus,
	User,
	UserRole,
	UserStatus,
} from "@/generated/prisma/client";
import { subtractDays } from "@/shared/domain/date/utils/arithmetic";
import { now } from "@/shared/domain/date/utils/core";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

export interface UserWithAccount {
	id: string;
	email: string;
	status: UserStatus;
	emailVerifiedAt: Date | null;
	accounts: {
		id: number;
		provider: string;
		password: string | null;
	}[];
}

// 비밀번호 등 민감 정보 제외
export interface UserWithProfile {
	id: string;
	email: string;
	userTag: string;
	role: UserRole;
	status: UserStatus;
	emailVerifiedAt: Date | null;
	subscriptionStatus: SubscriptionStatus;
	subscriptionExpiresAt: Date | null;
	createdAt: Date;
	lastLoginAt: Date | null;
	profile: {
		name: string | null;
		profileImage: string | null;
	} | null;
	accounts: {
		provider: AccountProvider;
	}[];
}

@Injectable()
export class UserRepository {
	readonly #logger = new Logger(UserRepository.name);
	private static readonly MAX_USER_TAG_RETRIES = 5;

	constructor(
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
	) {}

	/** 활성 트랜잭션(없으면 베이스 클라이언트) */
	private get client() {
		return this.txHost.tx;
	}

	async findByEmail(email: string): Promise<User | null> {
		return this.client.user.findUnique({
			where: { email },
		});
	}

	async findByEmailWithCredential(
		email: string,
	): Promise<UserWithAccount | null> {
		return this.client.user.findUnique({
			where: { email },
			select: {
				id: true,
				email: true,
				status: true,
				emailVerifiedAt: true,
				accounts: {
					where: { provider: "CREDENTIAL" },
					select: {
						id: true,
						provider: true,
						password: true,
					},
				},
			},
		});
	}

	async findById(id: string): Promise<User | null> {
		return this.client.user.findUnique({
			where: { id },
		});
	}

	async findByIdWithProfile(id: string): Promise<UserWithProfile | null> {
		return this.client.user.findUnique({
			where: { id },
			select: {
				id: true,
				email: true,
				userTag: true,
				role: true,
				status: true,
				emailVerifiedAt: true,
				subscriptionStatus: true,
				subscriptionExpiresAt: true,
				createdAt: true,
				lastLoginAt: true,
				profile: {
					select: {
						name: true,
						profileImage: true,
					},
				},
				accounts: {
					select: {
						provider: true,
					},
				},
			},
		});
	}

	async existsByEmail(email: string): Promise<boolean> {
		const count = await this.client.user.count({
			where: { email },
		});
		return count > 0;
	}

	// userTag가 없으면 자동 생성 (중복 시 재시도)
	async create(
		data: Omit<Prisma.UserCreateInput, "userTag"> & {
			userTag?: string;
		},
	): Promise<User> {
		// userTag가 제공되지 않으면 자동 생성
		const userTag = data.userTag ?? (await this.#generateUniqueUserTag());

		return this.client.user.create({
			data: {
				...data,
				userTag,
			},
		});
	}

	async #generateUniqueUserTag(): Promise<string> {
		for (let i = 0; i < UserRepository.MAX_USER_TAG_RETRIES; i++) {
			const tag = generateUserTag();
			const exists = await this.client.user.findUnique({
				where: { userTag: tag },
				select: { id: true },
			});

			if (!exists) {
				return tag;
			}

			this.#logger.warn(`User tag collision detected: ${tag}, retrying...`);
		}

		// 모든 재시도 실패 시 (극히 드문 경우)
		throw new ApplicationException(ErrorCode.USER_0611, {
			attempts: UserRepository.MAX_USER_TAG_RETRIES,
		});
	}

	async updateStatus(id: string, status: UserStatus): Promise<User> {
		return this.client.user.update({
			where: { id },
			data: { status },
		});
	}

	async markEmailVerified(id: string): Promise<User> {
		return this.client.user.update({
			where: { id },
			data: {
				emailVerifiedAt: now(),
				status: "ACTIVE",
			},
		});
	}

	async updateLastLoginAt(id: string): Promise<void> {
		await this.client.user.update({
			where: { id },
			data: { lastLoginAt: now() },
		});
	}

	async updateLastActiveAt(id: string): Promise<void> {
		await this.client.user.update({
			where: { id },
			data: { lastActiveAt: now() },
		});
	}

	async createProfile(
		userId: string,
		data: { name?: string; profileImage?: string },
	): Promise<void> {
		await this.client.userProfile.create({
			data: {
				userId,
				name: data.name ?? null,
				profileImage: data.profileImage ?? null,
			},
		});
	}

	async updateProfile(
		userId: string,
		data: { name?: string | null; profileImage?: string | null },
	): Promise<{ name: string | null; profileImage: string | null }> {
		// upsert로 프로필이 없는 경우에도 생성
		const profile = await this.client.userProfile.upsert({
			where: { userId },
			create: {
				userId,
				name: data.name ?? null,
				profileImage: data.profileImage ?? null,
			},
			update: {
				...(data.name !== undefined && { name: data.name }),
				...(data.profileImage !== undefined && {
					profileImage: data.profileImage,
				}),
			},
			select: {
				name: true,
				profileImage: true,
			},
		});

		return profile;
	}

	async softDelete(id: string): Promise<User> {
		return this.client.user.update({
			where: { id },
			data: { deletedAt: now(), status: "SUSPENDED" },
		});
	}

	async restore(id: string): Promise<User> {
		return this.client.user.update({
			where: { id },
			data: { deletedAt: null, status: "ACTIVE" },
		});
	}

	async findSoftDeletedForPurge(
		gracePeriodDays: number,
	): Promise<{ id: string; email: string; deletedAt: Date }[]> {
		const cutoff = subtractDays(gracePeriodDays);
		const rows = await this.client.user.findMany({
			where: { deletedAt: { not: null, lt: cutoff } },
			select: { id: true, email: true, deletedAt: true },
		});
		// WHERE deletedAt not null 이 보장하지만 Prisma 타입은 Date|null 이므로
		// 타입 가드 필터로 non-null을 좁힌다(캐스트 없이 정합).
		return rows.filter(
			(row): row is { id: string; email: string; deletedAt: Date } =>
				row.deletedAt !== null,
		);
	}

	async hardDelete(id: string): Promise<void> {
		await this.client.user.delete({ where: { id } });
	}
}
