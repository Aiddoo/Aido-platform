import { Injectable } from "@nestjs/common";

import { DatabaseService } from "@/database";
import type { Prisma, User, UserStatus } from "@/generated/prisma/client";

/**
 * 사용자 조회 결과 (인증용)
 */
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

/**
 * 사용자 프로필 조회 결과
 */
export interface UserWithProfile {
	id: string;
	email: string;
	status: UserStatus;
	emailVerifiedAt: Date | null;
	createdAt: Date;
	lastLoginAt: Date | null;
	profile: {
		name: string | null;
		profileImage: string | null;
	} | null;
}

@Injectable()
export class UserRepository {
	constructor(private readonly database: DatabaseService) {}

	/**
	 * 이메일로 사용자 조회
	 */
	async findByEmail(email: string): Promise<User | null> {
		return this.database.user.findUnique({
			where: { email },
		});
	}

	/**
	 * 이메일로 사용자 + Credential 계정 조회 (로그인용)
	 */
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

	/**
	 * ID로 사용자 조회
	 */
	async findById(id: string): Promise<User | null> {
		return this.database.user.findUnique({
			where: { id },
		});
	}

	/**
	 * ID로 사용자 + 프로필 조회
	 */
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
				status: true,
				emailVerifiedAt: true,
				createdAt: true,
				lastLoginAt: true,
				profile: {
					select: {
						name: true,
						profileImage: true,
					},
				},
			},
		});
	}

	/**
	 * 이메일 중복 확인
	 */
	async existsByEmail(email: string): Promise<boolean> {
		const count = await this.database.user.count({
			where: { email },
		});
		return count > 0;
	}

	/**
	 * 사용자 생성 (회원가입 트랜잭션 내에서 사용)
	 */
	async create(
		data: Prisma.UserCreateInput,
		tx?: Prisma.TransactionClient,
	): Promise<User> {
		const client = tx ?? this.database;
		return client.user.create({ data });
	}

	/**
	 * 사용자 상태 업데이트
	 */
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

	/**
	 * 이메일 인증 완료 처리
	 */
	async markEmailVerified(
		id: string,
		tx?: Prisma.TransactionClient,
	): Promise<User> {
		const client = tx ?? this.database;
		return client.user.update({
			where: { id },
			data: {
				emailVerifiedAt: new Date(),
				status: "ACTIVE",
			},
		});
	}

	/**
	 * 마지막 로그인 시간 업데이트
	 */
	async updateLastLoginAt(
		id: string,
		tx?: Prisma.TransactionClient,
	): Promise<void> {
		const client = tx ?? this.database;
		await client.user.update({
			where: { id },
			data: { lastLoginAt: new Date() },
		});
	}

	/**
	 * 프로필 생성 (회원가입 시)
	 */
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

	/**
	 * 프로필 업데이트
	 */
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
}
