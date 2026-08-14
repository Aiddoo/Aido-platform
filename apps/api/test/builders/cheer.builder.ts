/**
 * Cheer 모델 테스트 데이터 빌더
 *
 * @example
 * ```typescript
 * // 기본 응원
 * const cheer = CheerBuilder.create('sender-123', 'receiver-456').build();
 *
 * // 메시지가 있는 응원
 * const withMessage = CheerBuilder.create('sender-123', 'receiver-456')
 *   .withMessage('화이팅!')
 *   .build();
 *
 * // 읽은 응원
 * const readCheer = CheerBuilder.create('sender-123', 'receiver-456')
 *   .asRead()
 *   .build();
 *
 * // 관계 정보 포함
 * const withRelations = CheerBuilder.create('sender-123', 'receiver-456')
 *   .withSenderProfile({ name: '홍길동', profileImage: null })
 *   .buildWithRelations();
 * ```
 */
import type { Cheer } from "@/generated/prisma/client";

/**
 * 사용자 프로필 정보
 */
export interface CheerUserProfile {
	name: string | null;
	profileImage: string | null;
}

/**
 * 사용자 정보 (Cheer 관계용)
 */
export interface CheerUserInfo {
	id: string;
	userTag: string;
	profile: CheerUserProfile | null;
}

/**
 * 관계 정보 포함 Cheer
 */
export interface CheerWithRelations extends Cheer {
	sender: CheerUserInfo;
	receiver: CheerUserInfo;
}

export class CheerBuilder {
	private data: Cheer;
	private static idCounter = 0;
	private senderInfo: CheerUserInfo | null = null;
	private receiverInfo: CheerUserInfo | null = null;

	private constructor(senderId: string, receiverId: string) {
		const now = new Date();
		CheerBuilder.idCounter += 1;
		this.data = {
			id: CheerBuilder.idCounter,
			senderId,
			receiverId,
			message: null,
			createdAt: now,
			readAt: null,
		};
	}

	static create(senderId: string, receiverId: string): CheerBuilder {
		return new CheerBuilder(senderId, receiverId);
	}

	/** ID 카운터 리셋 (테스트 간 격리용) */
	static resetIdCounter(): void {
		CheerBuilder.idCounter = 0;
	}

	// === ID 관련 ===

	withId(id: number): CheerBuilder {
		this.data.id = id;
		return this;
	}

	// === 메시지 관련 ===

	withMessage(message: string | null): CheerBuilder {
		this.data.message = message;
		return this;
	}

	// === 읽음 상태 ===

	asRead(readAt?: Date): CheerBuilder {
		this.data.readAt = readAt ?? new Date();
		return this;
	}

	asUnread(): CheerBuilder {
		this.data.readAt = null;
		return this;
	}

	// === 관계 사용자 정보 ===

	withSenderInfo(info: CheerUserInfo): CheerBuilder {
		this.senderInfo = info;
		return this;
	}

	withReceiverInfo(info: CheerUserInfo): CheerBuilder {
		this.receiverInfo = info;
		return this;
	}

	withSenderProfile(profile: CheerUserProfile): CheerBuilder {
		this.senderInfo = {
			id: this.data.senderId,
			userTag: "SENDER01",
			profile,
		};
		return this;
	}

	withReceiverProfile(profile: CheerUserProfile): CheerBuilder {
		this.receiverInfo = {
			id: this.data.receiverId,
			userTag: "RECEIVER",
			profile,
		};
		return this;
	}

	// === 타임스탬프 관련 ===

	withCreatedAt(date: Date): CheerBuilder {
		this.data.createdAt = date;
		return this;
	}

	// === 빌드 ===

	build(): Cheer {
		return { ...this.data };
	}

	/** 관계 정보 포함 빌드 */
	buildWithRelations(): CheerWithRelations {
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
		};
	}

	/** 여러 개 생성 */
	static createMany(senderId: string, receiverIds: string[]): Cheer[] {
		return receiverIds.map((receiverId) => CheerBuilder.create(senderId, receiverId).build());
	}
}
