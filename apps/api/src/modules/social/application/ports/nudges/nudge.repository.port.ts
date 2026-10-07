import type { Nudge, NudgeProps } from "../../../domain/aggregates/nudges/nudge.aggregate.js";
import type { ReminderNudge } from "../../../domain/aggregates/nudges/reminder-nudge.aggregate.js";

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

export interface NudgeInteractionRecord
  extends
    NudgeWithRelations,
    Pick<NudgeProps, "replyKind" | "repliedAt" | "replyUpdatedAt" | "thankedAt"> {
  todo: NudgeTodoBrief & { ownerId: string; visibility: string };
}

export interface NudgeInteractionTodo {
  id: number;
  ownerId: string;
  title: string;
  completed: boolean;
  visibility: string;
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

export interface FindNudgeThanksCandidatesInput {
  readonly userId: string;
  readonly todoId: number;
  readonly throughNudgeId: number;
  readonly friendIds: readonly string[];
}

export interface NudgeThanksCandidatePage {
  items: NudgeInteractionRecord[];
  totalRecipients: number;
  nextCursor: number | null;
  hasNext: boolean;
}

/** 콕 찌르기 생성 입력 */
export interface CreateNudgeInput {
  senderId: string;
  receiverId: string;
  todoId: number;
  message?: string;
  createdAt: Date;
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
  findLastNudgeToUser(senderId: string, receiverId: string): Promise<Nudge | null>;
  findLastRemindNudge(senderId: string, receiverId: string): Promise<ReminderNudge | null>;
  findTargetTodo(todoId: number): Promise<TargetTodoRecord | null>;
  saveRead(nudge: Nudge): Promise<void>;
  saveReply(nudge: Nudge): Promise<void>;
  saveThanksBatch(nudgeIds: readonly number[], thankedAt: Date): Promise<void>;
  findInteractionById(id: number, userId: string): Promise<NudgeInteractionRecord | null>;
  findInteractions(
    params: FindNudgesParams & { direction: "received" | "sent" },
  ): Promise<NudgeInteractionRecord[]>;
  findInteractionTodo(todoId: number, userId: string): Promise<NudgeInteractionTodo | null>;
  lockInteractionTodo(todoId: number, userId: string): Promise<NudgeInteractionTodo | null>;
  findLastReceivedNudgeId(todoId: number, userId: string): Promise<number | null>;
  findThanksCandidates(input: FindNudgeThanksCandidatesInput): Promise<NudgeInteractionRecord[]>;
  findThanksCandidatePage(
    input: FindNudgeThanksCandidatesInput & { cursor?: number; size: number },
  ): Promise<NudgeThanksCandidatePage>;

  findReceivedNudges(params: FindNudgesParams): Promise<NudgeWithRelations[]>;
  findSentNudges(params: FindNudgesParams): Promise<NudgeWithRelations[]>;

  countTodayNudges(senderId: string, date: Date): Promise<number>;
  countSentSince(senderId: string, since: Date, untilExclusive: Date): Promise<number>;
  countTodayTodos(userId: string, today: Date): Promise<number>;
  countReceived(userId: string): Promise<number>;
  countSent(userId: string): Promise<number>;
  countUnreadReceived(userId: string): Promise<number>;

  createNudge(input: CreateNudgeInput): Promise<NudgeWithRelations>;
  createRemindNudge(input: CreateRemindNudgeInput): Promise<ReminderNudgeWithRelations>;
}
