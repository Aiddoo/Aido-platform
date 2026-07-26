import type { Cheer } from "../../domain/entities/cheer.entity";

/** 응원 목록/응답에 필요한 사용자 요약 */
export interface CheerUserBrief {
	id: string;
	userTag: string;
	profile: { name: string | null; profileImage: string | null } | null;
}

/** 응원 읽기 프로젝션의 기본 필드 */
export interface CheerRecord {
	id: number;
	senderId: string;
	receiverId: string;
	message: string | null;
	readAt: Date | null;
	createdAt: Date;
}

/** 양측 사용자 정보가 포함된 응원 읽기 프로젝션 */
export interface CheerWithRelations extends CheerRecord {
	sender: CheerUserBrief;
	receiver: CheerUserBrief;
}

/** 목록 조회 파라미터 */
export interface FindCheersParams {
	userId: string;
	cursor?: number;
	size: number;
}

/** 응원 생성 입력 */
export interface CreateCheerInput {
	senderId: string;
	receiverId: string;
	message?: string;
	createdAt: Date;
}

export const CHEER_REPOSITORY = Symbol("CHEER_REPOSITORY");

export interface CheerRepositoryPort {
	findById(id: number): Promise<Cheer | null>;
	findLastCheerToUser(
		senderId: string,
		receiverId: string,
	): Promise<Cheer | null>;
	markAsRead(id: number): Promise<void>;
	markManyAsRead(ids: number[], receiverId: string): Promise<number>;

	findReceivedCheers(params: FindCheersParams): Promise<CheerWithRelations[]>;
	findSentCheers(params: FindCheersParams): Promise<CheerWithRelations[]>;

	countTodayCheers(senderId: string, date: Date): Promise<number>;
	countSentSince(
		senderId: string,
		since: Date,
		untilExclusive: Date,
	): Promise<number>;
	countReceived(userId: string): Promise<number>;
	countSent(userId: string): Promise<number>;
	countUnreadReceived(userId: string): Promise<number>;

	createWithRelations(input: CreateCheerInput): Promise<CheerWithRelations>;
}
