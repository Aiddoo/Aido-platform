import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { Injectable } from "@nestjs/common";
import { compact } from "es-toolkit";

import type * as PrismaModels from "#api/generated/prisma/client";
import { Prisma } from "#api/generated/prisma/client";
import { addDays } from "#api/shared/domain/date/utils/arithmetic";
import { startOfDay } from "#api/shared/domain/date/utils/range";
import type { DatabaseService } from "#api/shared/infrastructure/database/database.service";
import { USER_BRIEF_SELECT } from "#api/shared/infrastructure/database/selects";

import type {
	CreateNudgeInput,
	CreateRemindNudgeInput,
	FindNudgesParams,
	FindNudgeThanksCandidatesInput,
	NudgeThanksCandidatePage,
	NudgeRepositoryPort,
	NudgeWithRelations,
	NudgeInteractionRecord,
	NudgeInteractionTodo,
	ReminderNudgeWithRelations,
	TargetTodoRecord,
} from "../../application/ports/nudge.repository.port.js";
import { Nudge } from "../../domain/entities/nudge.aggregate.js";
import { ReminderNudge } from "../../domain/entities/reminder-nudge.aggregate.js";

type UserBriefRow = {
	id: string;
	userTag: string;
	profile: { name: string | null; profileImage: string | null } | null;
};
type TodoBriefRow = { id: number; title: string; completed: boolean };
type NudgeRowWithRelations = PrismaModels.Nudge & {
	sender: UserBriefRow;
	receiver: UserBriefRow;
	todo: TodoBriefRow;
};
type NudgeInteractionRow = NudgeRowWithRelations & {
	todo: TodoBriefRow & { userId: string; visibility: string };
};
type ReminderNudgeRowWithRelations = PrismaModels.ReminderNudge & {
	sender: UserBriefRow;
};

const TODO_BRIEF_SELECT = { id: true, title: true, completed: true } as const;

const NUDGE_INCLUDE = {
	sender: { select: USER_BRIEF_SELECT },
	receiver: { select: USER_BRIEF_SELECT },
	todo: { select: TODO_BRIEF_SELECT },
} as const;

const REMIND_NUDGE_INCLUDE = {
	sender: { select: USER_BRIEF_SELECT },
} as const;

const NUDGE_INTERACTION_INCLUDE = {
	...NUDGE_INCLUDE,
	todo: { select: { ...TODO_BRIEF_SELECT, userId: true, visibility: true } },
} satisfies PrismaModels.Prisma.NudgeInclude;

/**
 * NudgeRepositoryPort의 Prisma 어댑터.
 * 단건 조회는 Nudge/ReminderNudge 애그리게잇을, 목록/생성은 관계 포함 프로젝션을 반환한다.
 * 트랜잭션은 CLS(TransactionHost.tx)로 전파된다.
 */
@Injectable()
export class PrismaNudgeRepository implements NudgeRepositoryPort {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<DatabaseService>>,
	) {}

	private get client() {
		return this.txHost.tx;
	}

	private static toNudge(row: PrismaModels.Nudge): Nudge {
		return Nudge.reconstitute({
			id: row.id,
			senderId: row.senderId,
			receiverId: row.receiverId,
			todoId: row.todoId,
			message: row.message,
			readAt: row.readAt,
			createdAt: row.createdAt,
			replyKind: row.replyKind,
			repliedAt: row.repliedAt,
			replyUpdatedAt: row.replyUpdatedAt,
			thankedAt: row.thankedAt,
		});
	}

	private static toReminderNudge(row: PrismaModels.ReminderNudge): ReminderNudge {
		return ReminderNudge.reconstitute({
			id: row.id,
			senderId: row.senderId,
			receiverId: row.receiverId,
			message: row.message,
			createdAt: row.createdAt,
		});
	}

	private static toWithRelations(row: NudgeRowWithRelations): NudgeWithRelations {
		return {
			id: row.id,
			senderId: row.senderId,
			receiverId: row.receiverId,
			todoId: row.todoId,
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
			todo: {
				id: row.todo.id,
				title: row.todo.title,
				completed: row.todo.completed,
			},
		};
	}

	private static toRemindWithRelations(
		row: ReminderNudgeRowWithRelations,
	): ReminderNudgeWithRelations {
		return {
			id: row.id,
			senderId: row.senderId,
			receiverId: row.receiverId,
			message: row.message,
			createdAt: row.createdAt,
			sender: {
				id: row.sender.id,
				userTag: row.sender.userTag,
				profile: row.sender.profile,
			},
		};
	}

	async findById(id: number): Promise<Nudge | null> {
		const row = await this.client.nudge.findUnique({ where: { id } });
		return row ? PrismaNudgeRepository.toNudge(row) : null;
	}

	async findLastNudgeForTodo(senderId: string, todoId: number): Promise<Nudge | null> {
		const row = await this.client.nudge.findFirst({
			where: { senderId, todoId },
			orderBy: { createdAt: "desc" },
		});
		return row ? PrismaNudgeRepository.toNudge(row) : null;
	}

	async findLastNudgeToUser(senderId: string, receiverId: string): Promise<Nudge | null> {
		const row = await this.client.nudge.findFirst({
			where: { senderId, receiverId },
			orderBy: { createdAt: "desc" },
		});
		return row ? PrismaNudgeRepository.toNudge(row) : null;
	}

	async findLastRemindNudge(senderId: string, receiverId: string): Promise<ReminderNudge | null> {
		const row = await this.client.reminderNudge.findFirst({
			where: { senderId, receiverId },
			orderBy: { createdAt: "desc" },
		});
		return row ? PrismaNudgeRepository.toReminderNudge(row) : null;
	}

	async findTargetTodo(todoId: number): Promise<TargetTodoRecord | null> {
		const row = await this.client.todo.findUnique({
			where: { id: todoId },
			select: {
				userId: true,
				visibility: true,
				startDate: true,
				endDate: true,
			},
		});
		if (!row) {
			return null;
		}
		return {
			ownerId: row.userId,
			visibility: row.visibility,
			startDate: row.startDate,
			endDate: row.endDate,
		};
	}

	async saveRead(nudge: Nudge): Promise<void> {
		await this.client.nudge.updateMany({
			where: { id: nudge.id, readAt: null },
			data: { readAt: nudge.readAt },
		});
	}

	async saveReply(nudge: Nudge): Promise<void> {
		const state = nudge.toPersistence();
		await this.client.nudge.update({
			where: { id: nudge.id },
			data: {
				replyKind: state.replyKind,
				repliedAt: state.repliedAt,
				replyUpdatedAt: state.replyUpdatedAt,
			},
		});
		await this.saveRead(nudge);
	}

	async saveThanksBatch(nudgeIds: readonly number[], thankedAt: Date): Promise<void> {
		if (nudgeIds.length === 0) return;
		await this.client.nudge.updateMany({
			where: { id: { in: [...nudgeIds] }, thankedAt: null },
			data: { thankedAt },
		});
	}

	private static toInteraction(row: NudgeInteractionRow): NudgeInteractionRecord {
		return {
			...PrismaNudgeRepository.toWithRelations(row),
			replyKind: row.replyKind,
			repliedAt: row.repliedAt,
			replyUpdatedAt: row.replyUpdatedAt,
			thankedAt: row.thankedAt,
			todo: {
				id: row.todo.id,
				title: row.todo.title,
				completed: row.todo.completed,
				ownerId: row.todo.userId,
				visibility: row.todo.visibility,
			},
		};
	}

	async findInteractionById(id: number, userId: string): Promise<NudgeInteractionRecord | null> {
		const row = await this.client.nudge.findFirst({
			where: { id, OR: [{ senderId: userId }, { receiverId: userId }] },
			include: NUDGE_INTERACTION_INCLUDE,
		});
		return row ? PrismaNudgeRepository.toInteraction(row) : null;
	}

	async findInteractions(
		params: FindNudgesParams & { direction: "received" | "sent" },
	): Promise<NudgeInteractionRecord[]> {
		const rows = await this.client.nudge.findMany({
			where: {
				...(params.direction === "received"
					? { receiverId: params.userId }
					: { senderId: params.userId }),
				...(params.cursor !== undefined && { id: { lt: params.cursor } }),
			},
			include: NUDGE_INTERACTION_INCLUDE,
			take: params.size + 1,
			orderBy: { id: "desc" },
		});
		return rows.map(PrismaNudgeRepository.toInteraction);
	}

	async lockInteractionTodo(todoId: number, userId: string): Promise<NudgeInteractionTodo | null> {
		// 완료·공개 상태 변경과 답장·감사 저장을 같은 행 잠금으로 직렬화한다.
		const rows = await this.client.$queryRaw<NudgeInteractionTodo[]>(Prisma.sql`
			SELECT "id", "userId" AS "ownerId", "title", "completed", "visibility"
			FROM "Todo" WHERE "id" = ${todoId} AND "userId" = ${userId} FOR UPDATE
		`);
		return rows[0] ?? null;
	}

	async findInteractionTodo(todoId: number, userId: string): Promise<NudgeInteractionTodo | null> {
		const row = await this.client.todo.findUnique({
			where: { id: todoId, userId },
			select: { id: true, userId: true, title: true, completed: true, visibility: true },
		});
		return row
			? {
					id: row.id,
					ownerId: row.userId,
					title: row.title,
					completed: row.completed,
					visibility: row.visibility,
				}
			: null;
	}

	async findLastReceivedNudgeId(todoId: number, userId: string): Promise<number | null> {
		const row = await this.client.nudge.findFirst({
			where: { todoId, receiverId: userId },
			select: { id: true },
			orderBy: { id: "desc" },
		});
		return row?.id ?? null;
	}

	async findThanksCandidates(
		input: FindNudgeThanksCandidatesInput,
	): Promise<NudgeInteractionRecord[]> {
		const ids = await this.#findThanksCandidateIds(input);
		return this.#findThanksCandidatesByIds(ids);
	}

	async findThanksCandidatePage(
		input: FindNudgeThanksCandidatesInput & { cursor?: number; size: number },
	): Promise<NudgeThanksCandidatePage> {
		const ids = await this.#findThanksCandidateIds(input);
		const { cursor } = input;
		const remainingIds = cursor === undefined ? ids : ids.filter((id) => id < cursor);
		const pageIds = remainingIds.slice(0, input.size);
		const hasNext = remainingIds.length > pageIds.length;
		return {
			items: await this.#findThanksCandidatesByIds(pageIds),
			totalRecipients: ids.length,
			hasNext,
			nextCursor: hasNext ? (pageIds.at(-1) ?? null) : null,
		};
	}

	async #findThanksCandidateIds(input: FindNudgeThanksCandidatesInput): Promise<number[]> {
		if (input.friendIds.length === 0) {
			return [];
		}
		const thanked = await this.client.nudge.findMany({
			where: { todoId: input.todoId, receiverId: input.userId, thankedAt: { not: null } },
			select: { senderId: true },
		});
		const groups = await this.client.nudge.groupBy({
			by: ["senderId"],
			where: {
				todoId: input.todoId,
				receiverId: input.userId,
				id: { lte: input.throughNudgeId },
				senderId: { in: [...input.friendIds], notIn: thanked.map((item) => item.senderId) },
				thankedAt: null,
				todo: { visibility: "PUBLIC", userId: input.userId },
			},
			_max: { id: true },
		});
		return compact(groups.map((group) => group._max.id)).sort((left, right) => right - left);
	}

	async #findThanksCandidatesByIds(ids: readonly number[]): Promise<NudgeInteractionRecord[]> {
		if (ids.length === 0) return [];
		const rows = await this.client.nudge.findMany({
			where: { id: { in: [...ids] } },
			include: NUDGE_INTERACTION_INCLUDE,
			orderBy: { id: "desc" },
		});
		return rows.map(PrismaNudgeRepository.toInteraction);
	}

	async findReceivedNudges(params: FindNudgesParams): Promise<NudgeWithRelations[]> {
		const { userId, cursor, size } = params;
		const rows = await this.client.nudge.findMany({
			where: { receiverId: userId },
			include: NUDGE_INCLUDE,
			take: size + 1,
			...(cursor != null && { skip: 1, cursor: { id: cursor } }),
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		});
		return rows.map((row) => PrismaNudgeRepository.toWithRelations(row));
	}

	async findSentNudges(params: FindNudgesParams): Promise<NudgeWithRelations[]> {
		const { userId, cursor, size } = params;
		const rows = await this.client.nudge.findMany({
			where: { senderId: userId },
			include: NUDGE_INCLUDE,
			take: size + 1,
			...(cursor != null && { skip: 1, cursor: { id: cursor } }),
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		});
		return rows.map((row) => PrismaNudgeRepository.toWithRelations(row));
	}

	async countTodayNudges(senderId: string, date: Date): Promise<number> {
		const dayStart = startOfDay(date);
		const dayEnd = addDays(1, dayStart);
		return this.client.nudge.count({
			where: { senderId, createdAt: { gte: dayStart, lt: dayEnd } },
		});
	}

	async countSentSince(senderId: string, since: Date, untilExclusive: Date): Promise<number> {
		return this.client.nudge.count({
			where: {
				senderId,
				createdAt: { gte: since, lt: untilExclusive },
			},
		});
	}

	async countTodayTodos(userId: string, today: Date): Promise<number> {
		return this.client.todo.count({
			where: {
				userId,
				OR: [
					{ startDate: { lte: today }, endDate: { gte: today } },
					{ startDate: today, endDate: null },
				],
			},
		});
	}

	async countReceived(userId: string): Promise<number> {
		return this.client.nudge.count({ where: { receiverId: userId } });
	}

	async countSent(userId: string): Promise<number> {
		return this.client.nudge.count({ where: { senderId: userId } });
	}

	async countUnreadReceived(userId: string): Promise<number> {
		return this.client.nudge.count({
			where: { receiverId: userId, readAt: null },
		});
	}

	async createNudge(input: CreateNudgeInput): Promise<NudgeWithRelations> {
		const row = await this.client.nudge.create({
			data: {
				sender: { connect: { id: input.senderId } },
				receiver: { connect: { id: input.receiverId } },
				todo: { connect: { id: input.todoId } },
				message: input.message,
				createdAt: input.createdAt,
			},
			include: NUDGE_INCLUDE,
		});
		return PrismaNudgeRepository.toWithRelations(row);
	}

	async createRemindNudge(input: CreateRemindNudgeInput): Promise<ReminderNudgeWithRelations> {
		const row = await this.client.reminderNudge.create({
			data: {
				sender: { connect: { id: input.senderId } },
				receiver: { connect: { id: input.receiverId } },
				message: input.message,
			},
			include: REMIND_NUDGE_INCLUDE,
		});
		return PrismaNudgeRepository.toRemindWithRelations(row);
	}
}
