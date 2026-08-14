import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";

import type * as PrismaModels from "@/generated/prisma/client";
import { addDays } from "@/shared/domain/date/utils/arithmetic";
import { now } from "@/shared/domain/date/utils/core";
import { startOfDay } from "@/shared/domain/date/utils/range";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { USER_BRIEF_SELECT } from "@/shared/infrastructure/database/selects";

import type {
	CreateNudgeInput,
	CreateRemindNudgeInput,
	FindNudgesParams,
	NudgeRepositoryPort,
	NudgeWithRelations,
	ReminderNudgeWithRelations,
	TargetTodoRecord,
} from "../../application/ports/nudge.repository.port";
import { Nudge } from "../../domain/entities/nudge.aggregate";
import { ReminderNudge } from "../../domain/entities/reminder-nudge.entity";

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

/**
 * NudgeRepositoryPort의 Prisma 어댑터.
 * 단건 조회는 Nudge/ReminderNudge 애그리게잇을, 목록/생성은 관계 포함 프로젝션을 반환한다.
 * 트랜잭션은 CLS(TransactionHost.tx)로 전파된다.
 */
@Injectable()
export class PrismaNudgeRepository implements NudgeRepositoryPort {
	constructor(
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
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
		});
	}

	private static toReminderNudge(
		row: PrismaModels.ReminderNudge,
	): ReminderNudge {
		return ReminderNudge.reconstitute({
			id: row.id,
			senderId: row.senderId,
			receiverId: row.receiverId,
			message: row.message,
			createdAt: row.createdAt,
		});
	}

	private static toWithRelations(
		row: NudgeRowWithRelations,
	): NudgeWithRelations {
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

	async findLastNudgeForTodo(
		senderId: string,
		todoId: number,
	): Promise<Nudge | null> {
		const row = await this.client.nudge.findFirst({
			where: { senderId, todoId },
			orderBy: { createdAt: "desc" },
		});
		return row ? PrismaNudgeRepository.toNudge(row) : null;
	}

	async findLastNudgeToUser(
		senderId: string,
		receiverId: string,
	): Promise<Nudge | null> {
		const row = await this.client.nudge.findFirst({
			where: { senderId, receiverId },
			orderBy: { createdAt: "desc" },
		});
		return row ? PrismaNudgeRepository.toNudge(row) : null;
	}

	async findLastRemindNudge(
		senderId: string,
		receiverId: string,
	): Promise<ReminderNudge | null> {
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

	async markAsRead(id: number): Promise<void> {
		await this.client.nudge.update({
			where: { id },
			data: { readAt: now() },
		});
	}

	async findReceivedNudges(
		params: FindNudgesParams,
	): Promise<NudgeWithRelations[]> {
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

	async findSentNudges(
		params: FindNudgesParams,
	): Promise<NudgeWithRelations[]> {
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

	async countSentSince(
		senderId: string,
		since: Date,
		untilExclusive: Date,
	): Promise<number> {
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

	async createRemindNudge(
		input: CreateRemindNudgeInput,
	): Promise<ReminderNudgeWithRelations> {
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
