import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";

import type { Cheer as CheerRow } from "@/generated/prisma/client";
import { addDays } from "@/shared/domain/date/utils/arithmetic";
import { now } from "@/shared/domain/date/utils/core";
import { startOfDay } from "@/shared/domain/date/utils/range";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { USER_BRIEF_SELECT } from "@/shared/infrastructure/database/selects";

import type {
	CheerRepositoryPort,
	CheerWithRelations,
	CreateCheerInput,
	FindCheersParams,
} from "../../application/ports/cheer.repository.port";
import { Cheer } from "../../domain/entities/cheer.entity";

type UserBriefRow = {
	id: string;
	userTag: string;
	profile: { name: string | null; profileImage: string | null } | null;
};
type CheerRowWithRelations = CheerRow & {
	sender: UserBriefRow;
	receiver: UserBriefRow;
};

const CHEER_INCLUDE = {
	sender: { select: USER_BRIEF_SELECT },
	receiver: { select: USER_BRIEF_SELECT },
} as const;

/**
 * CheerRepositoryPort의 Prisma 어댑터.
 * 단건 조회는 Cheer 애그리게잇을, 목록/생성은 CheerWithRelations 프로젝션을 반환한다.
 * 트랜잭션은 CLS(TransactionHost.tx)로 전파된다.
 */
@Injectable()
export class PrismaCheerRepository implements CheerRepositoryPort {
	constructor(
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
	) {}

	private get client() {
		return this.txHost.tx;
	}

	private static toCheer(row: CheerRow): Cheer {
		return Cheer.reconstitute({
			id: row.id,
			senderId: row.senderId,
			receiverId: row.receiverId,
			message: row.message,
			readAt: row.readAt,
			createdAt: row.createdAt,
		});
	}

	private static toWithRelations(
		row: CheerRowWithRelations,
	): CheerWithRelations {
		return {
			id: row.id,
			senderId: row.senderId,
			receiverId: row.receiverId,
			message: row.message,
			readAt: row.readAt,
			createdAt: row.createdAt,
			sender: {
				id: row.sender.id,
				userTag: row.sender.userTag,
				profile: row.sender.profile,
			},
			receiver: {
				id: row.receiver.id,
				userTag: row.receiver.userTag,
				profile: row.receiver.profile,
			},
		};
	}

	async findById(id: number): Promise<Cheer | null> {
		const row = await this.client.cheer.findUnique({ where: { id } });
		return row ? PrismaCheerRepository.toCheer(row) : null;
	}

	async findLastCheerToUser(
		senderId: string,
		receiverId: string,
	): Promise<Cheer | null> {
		const row = await this.client.cheer.findFirst({
			where: { senderId, receiverId },
			orderBy: { createdAt: "desc" },
		});
		return row ? PrismaCheerRepository.toCheer(row) : null;
	}

	async markAsRead(id: number): Promise<void> {
		await this.client.cheer.update({
			where: { id },
			data: { readAt: now() },
		});
	}

	async markManyAsRead(ids: number[], receiverId: string): Promise<number> {
		const result = await this.client.cheer.updateMany({
			where: { id: { in: ids }, receiverId, readAt: null },
			data: { readAt: now() },
		});
		return result.count;
	}

	async findReceivedCheers(
		params: FindCheersParams,
	): Promise<CheerWithRelations[]> {
		const { userId, cursor, size } = params;
		const rows = await this.client.cheer.findMany({
			where: { receiverId: userId },
			include: CHEER_INCLUDE,
			take: size + 1,
			...(cursor != null && { skip: 1, cursor: { id: cursor } }),
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		});
		return rows.map((row) => PrismaCheerRepository.toWithRelations(row));
	}

	async findSentCheers(
		params: FindCheersParams,
	): Promise<CheerWithRelations[]> {
		const { userId, cursor, size } = params;
		const rows = await this.client.cheer.findMany({
			where: { senderId: userId },
			include: CHEER_INCLUDE,
			take: size + 1,
			...(cursor != null && { skip: 1, cursor: { id: cursor } }),
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		});
		return rows.map((row) => PrismaCheerRepository.toWithRelations(row));
	}

	async countTodayCheers(senderId: string, date: Date): Promise<number> {
		const dayStart = startOfDay(date);
		const dayEnd = addDays(1, dayStart);
		return this.client.cheer.count({
			where: { senderId, createdAt: { gte: dayStart, lt: dayEnd } },
		});
	}

	async countSentSince(senderId: string, since: Date): Promise<number> {
		return this.client.cheer.count({
			where: { senderId, createdAt: { gte: since } },
		});
	}

	async countReceived(userId: string): Promise<number> {
		return this.client.cheer.count({ where: { receiverId: userId } });
	}

	async countSent(userId: string): Promise<number> {
		return this.client.cheer.count({ where: { senderId: userId } });
	}

	async countUnreadReceived(userId: string): Promise<number> {
		return this.client.cheer.count({
			where: { receiverId: userId, readAt: null },
		});
	}

	async createWithRelations(
		input: CreateCheerInput,
	): Promise<CheerWithRelations> {
		const row = await this.client.cheer.create({
			data: {
				sender: { connect: { id: input.senderId } },
				receiver: { connect: { id: input.receiverId } },
				message: input.message,
			},
			include: CHEER_INCLUDE,
		});
		return PrismaCheerRepository.toWithRelations(row);
	}
}
