import type { Nudge } from "../../domain/entities/nudge.entity";
import type { ReminderNudge } from "../../domain/entities/reminder-nudge.entity";

/** 콕 찌르기 목록/응답에 필요한 사용자 요약 */
export interface NudgeUserBrief {
	id: string;
	userTag: string;
	profile: { name: string | null; profileImage: string | null } | null;
}

/** 콕 찌르기 목록/응답에 필요한 할 일 요약 */
export interface NudgeTodoBrief {
	id: number;
	title: string;
	completed: boolean;
}

/** 콕 찌르기 읽기 프로젝션의 기본 필드 */
export interface NudgeRecord {
	id: number;
	senderId: string;
	receiverId: string;
	todoId: number;
	message: string | null;
	readAt: Date | null;
	createdAt: Date;
}

/** 사용자·할 일 정보가 포함된 콕 찌르기 읽기 프로젝션 */
export interface NudgeWithRelations extends NudgeRecord {
	sender: NudgeUserBrief;
	receiver: NudgeUserBrief;
	todo: NudgeTodoBrief;
}

/** 발신자 정보가 포함된 리마인드 콕 찌르기 읽기 프로젝션 */
export interface ReminderNudgeWithRelations {
	id: number;
	senderId: string;
	receiverId: string;
	message: string | null;
	createdAt: Date;
	sender: NudgeUserBrief;
}

/** 콕 찌르기 검증용 대상 할 일 프로젝션 */
export interface TargetTodoRecord {
	ownerId: string;
	visibility: string;
	startDate: Date;
	endDate: Date | null;
}

/** 목록 조회 파라미터 */
export interface FindNudgesParams {
	userId: string;
	cursor?: number;
	size: number;
}

/** 콕 찌르기 생성 입력 */
export interface CreateNudgeInput {
	senderId: string;
	receiverId: string;
	todoId: number;
	message?: string;
}

/** 리마인드 콕 찌르기 생성 입력 */
export interface CreateRemindNudgeInput {
	senderId: string;
	receiverId: string;
	message?: string;
}

export const NUDGE_REPOSITORY = Symbol("NUDGE_REPOSITORY");

export interface NudgeRepositoryPort {
	findById(id: number): Promise<Nudge | null>;
	findLastNudgeForTodo(senderId: string, todoId: number): Promise<Nudge | null>;
	findLastNudgeToUser(
		senderId: string,
		receiverId: string,
	): Promise<Nudge | null>;
	findLastRemindNudge(
		senderId: string,
		receiverId: string,
	): Promise<ReminderNudge | null>;
	findTargetTodo(todoId: number): Promise<TargetTodoRecord | null>;
	markAsRead(id: number): Promise<void>;

	findReceivedNudges(params: FindNudgesParams): Promise<NudgeWithRelations[]>;
	findSentNudges(params: FindNudgesParams): Promise<NudgeWithRelations[]>;

	countTodayNudges(senderId: string, date: Date): Promise<number>;
	countTodayTodos(userId: string, today: Date): Promise<number>;
	countReceived(userId: string): Promise<number>;
	countSent(userId: string): Promise<number>;
	countUnreadReceived(userId: string): Promise<number>;

	createNudge(input: CreateNudgeInput): Promise<NudgeWithRelations>;
	createRemindNudge(
		input: CreateRemindNudgeInput,
	): Promise<ReminderNudgeWithRelations>;
}
