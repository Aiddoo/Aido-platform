import { Injectable, Logger } from "@nestjs/common";
import { subtractDays } from "@/common/date/utils/arithmetic";
import { now } from "@/common/date/utils/core";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import { DatabaseService } from "@/database";
import type {
	AccountProvider,
	Prisma,
	SubscriptionStatus,
	User,
	UserRole,
	UserStatus,
} from "@/generated/prisma/client";
import { generateUserTag } from "../utils/user-tag.util";

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

	constructor(private readonly database: DatabaseService) {}

	async findByEmail(email: string): Promise<User | null> {
		return this.database.user.findUnique({
			where: { email },
		});
	}

	async findByEmailWithCredential(
		email: string,
	): Promise<UserWithAccount | null> {
		return this.database.user.findUnique({
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
		return this.database.user.findUnique({
			where: { id },
		});
	}

	async findByIdWithProfile(
		id: string,
		tx?: Prisma.TransactionClient,
	): Promise<UserWithProfile | null> {
		const client = tx ?? this.database;
		return client.user.findUnique({
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
		const count = await this.database.user.count({
			where: { email },
		});
		return count > 0;
	}

	// userTag가 없으면 자동 생성 (중복 시 재시도)
	async create(
		data: Omit<Prisma.UserCreateInput, "userTag"> & {
			userTag?: string;
		},
		tx?: Prisma.TransactionClient,
	): Promise<User> {
		const client = tx ?? this.database;

		// userTag가 제공되지 않으면 자동 생성
		const userTag = data.userTag ?? (await this.#generateUniqueUserTag(client));

		return client.user.create({
			data: {
				...data,
				userTag,
			},
		});
	}

	async #generateUniqueUserTag(
		client: Prisma.TransactionClient | DatabaseService,
	): Promise<string> {
		for (let i = 0; i < UserRepository.MAX_USER_TAG_RETRIES; i++) {
			const tag = generateUserTag();
			const exists = await client.user.findUnique({
				where: { userTag: tag },
				select: { id: true },
			});

			if (!exists) {
				return tag;
			}

			this.#logger.warn(`User tag collision detected: ${tag}, retrying...`);
		}

		// 모든 재시도 실패 시 (극히 드문 경우)
		throw BusinessExceptions.userTagGenerationFailed({
			attempts: UserRepository.MAX_USER_TAG_RETRIES,
		});
	}

	async updateStatus(
		id: string,
		status: UserStatus,
		tx?: Prisma.TransactionClient,
	): Promise<User> {
		const client = tx ?? this.database;
		return client.user.update({
			where: { id },
			data: { status },
		});
	}

	async markEmailVerified(
		id: string,
		tx?: Prisma.TransactionClient,
	): Promise<User> {
		const client = tx ?? this.database;
		return client.user.update({
			where: { id },
			data: {
				emailVerifiedAt: now(),
				status: "ACTIVE",
			},
		});
	}

	async updateLastLoginAt(
		id: string,
		tx?: Prisma.TransactionClient,
	): Promise<void> {
		const client = tx ?? this.database;
		await client.user.update({
			where: { id },
			data: { lastLoginAt: now() },
		});
	}

	async updateLastActiveAt(id: string): Promise<void> {
		await this.database.user.update({
			where: { id },
			data: { lastActiveAt: now() },
		});
	}

	async createProfile(
		userId: string,
		data: { name?: string; profileImage?: string },
		tx?: Prisma.TransactionClient,
	): Promise<void> {
		const client = tx ?? this.database;
		await client.userProfile.create({
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
		tx?: Prisma.TransactionClient,
	): Promise<{ name: string | null; profileImage: string | null }> {
		const client = tx ?? this.database;

		// upsert로 프로필이 없는 경우에도 생성
		const profile = await client.userProfile.upsert({
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

	async softDelete(id: string, tx?: Prisma.TransactionClient): Promise<User> {
		const client = tx ?? this.database;
		return client.user.update({
			where: { id },
			data: { deletedAt: now(), status: "SUSPENDED" },
		});
	}

	async restore(id: string, tx?: Prisma.TransactionClient): Promise<User> {
		const client = tx ?? this.database;
		return client.user.update({
			where: { id },
			data: { deletedAt: null, status: "ACTIVE" },
		});
	}

	async findSoftDeletedForPurge(
		gracePeriodDays: number,
	): Promise<{ id: string; email: string; deletedAt: Date }[]> {
		const cutoff = subtractDays(gracePeriodDays);
		return this.database.user.findMany({
			where: { deletedAt: { not: null, lt: cutoff } },
			select: { id: true, email: true, deletedAt: true },
		}) as Promise<{ id: string; email: string; deletedAt: Date }[]>;
	}

	async hardDelete(id: string, tx?: Prisma.TransactionClient): Promise<void> {
		const client = tx ?? this.database;
		await client.user.delete({ where: { id } });
	}
}
