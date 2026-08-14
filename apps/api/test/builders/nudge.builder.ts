/**
 * Nudge 모델 테스트 데이터 빌더
 *
 * @example
 * ```typescript
 * // 기본 콕 찌르기
 * const nudge = NudgeBuilder.create('sender-123', 'receiver-456', 1).build();
 *
 * // 메시지가 있는 콕 찌르기
 * const withMessage = NudgeBuilder.create('sender-123', 'receiver-456', 1)
 *   .withMessage('잊지 마!')
 *   .build();
 *
 * // 읽은 콕 찌르기
 * const readNudge = NudgeBuilder.create('sender-123', 'receiver-456', 1)
 *   .asRead()
 *   .build();
 *
 * // 관계 정보 포함
 * const withRelations = NudgeBuilder.create('sender-123', 'receiver-456', 1)
 *   .withSenderProfile({ name: '홍길동', profileImage: null })
 *   .buildWithRelations();
 * ```
 */
import type { Nudge } from "@/generated/prisma/client";

/**
 * 사용자 프로필 정보
 */
export interface NudgeUserProfile {
	name: string | null;
	profileImage: string | null;
}

/**
 * 사용자 정보 (Nudge 관계용)
 */
export interface NudgeUserInfo {
	id: string;
	userTag: string;
	profile: NudgeUserProfile | null;
}

/**
 * Todo 정보 (Nudge 관계용)
 */
export interface NudgeTodoInfo {
	id: number;
	title: string;
	completed: boolean;
}

/**
 * 관계 정보 포함 Nudge
 */
export interface NudgeWithRelations extends Nudge {
	sender: NudgeUserInfo;
	receiver: NudgeUserInfo;
	todo: NudgeTodoInfo;
}

export class NudgeBuilder {
	private data: Nudge;
	private static idCounter = 0;
	private senderInfo: NudgeUserInfo | null = null;
	private receiverInfo: NudgeUserInfo | null = null;
	private todoInfo: NudgeTodoInfo | null = null;

	private constructor(senderId: string, receiverId: string, todoId: number) {
		const now = new Date();
		NudgeBuilder.idCounter += 1;
		this.data = {
			id: NudgeBuilder.idCounter,
			senderId,
			receiverId,
			todoId,
			message: null,
			createdAt: now,
			readAt: null,
		};
	}

	static create(senderId: string, receiverId: string, todoId: number): NudgeBuilder {
		return new NudgeBuilder(senderId, receiverId, todoId);
	}

	/** ID 카운터 리셋 (테스트 간 격리용) */
	static resetIdCounter(): void {
		NudgeBuilder.idCounter = 0;
	}

	// === ID 관련 ===

	withId(id: number): NudgeBuilder {
		this.data.id = id;
		return this;
	}

	// === Todo 관련 ===

	withTodoId(todoId: number): NudgeBuilder {
		this.data.todoId = todoId;
		return this;
	}

	// === 메시지 관련 ===

	withMessage(message: string | null): NudgeBuilder {
		this.data.message = message;
		return this;
	}

	// === 읽음 상태 ===

	asRead(readAt?: Date): NudgeBuilder {
		this.data.readAt = readAt ?? new Date();
		return this;
	}

	asUnread(): NudgeBuilder {
		this.data.readAt = null;
		return this;
	}

	// === 관계 정보 ===

	withSenderInfo(info: NudgeUserInfo): NudgeBuilder {
		this.senderInfo = info;
		return this;
	}

	withReceiverInfo(info: NudgeUserInfo): NudgeBuilder {
		this.receiverInfo = info;
		return this;
	}

	withTodoInfo(info: NudgeTodoInfo): NudgeBuilder {
		this.todoInfo = info;
		this.data.todoId = info.id;
		return this;
	}

	withSenderProfile(profile: NudgeUserProfile): NudgeBuilder {
		this.senderInfo = {
			id: this.data.senderId,
			userTag: "SENDER01",
			profile,
		};
		return this;
	}

	withReceiverProfile(profile: NudgeUserProfile): NudgeBuilder {
		this.receiverInfo = {
			id: this.data.receiverId,
			userTag: "RECEIVER",
			profile,
		};
		return this;
	}

	// === 타임스탬프 관련 ===

	withCreatedAt(date: Date): NudgeBuilder {
		this.data.createdAt = date;
		return this;
	}

	// === 빌드 ===

	build(): Nudge {
		return { ...this.data };
	}

	/** 관계 정보 포함 빌드 */
	buildWithRelations(): NudgeWithRelations {
		return {
			...this.data,
			sender: this.senderInfo ?? {
				id: this.data.senderId,
				userTag: "SENDER01",
				profile: null,
			},
			receiver: this.receiverInfo ?? {
				id: this.data.receiverId,
				userTag: "RECEIVER",
				profile: null,
			},
			todo: this.todoInfo ?? {
				id: this.data.todoId,
				title: "테스트 할 일",
				completed: false,
			},
		};
	}

	/** 여러 개 생성 */
	static createMany(senderId: string, receiverId: string, todoIds: number[]): Nudge[] {
		return todoIds.map((todoId) => NudgeBuilder.create(senderId, receiverId, todoId).build());
	}
}
