export interface NudgeProps {
	id: number;
	senderId: string;
	receiverId: string;
	todoId: number;
	message: string | null;
	readAt: Date | null;
	createdAt: Date;
}

/**
 * Nudge — 콕 찌르기 애그리게잇.
 *
 * 친구의 특정 할 일(todoId)을 콕 찌른 한 건을 나타내며, 읽음 여부·수신자 소유 판별 등
 * 콕 찌르기에 관한 규칙을 캡슐화한다. 세터는 없다(불변 조회 모델).
 */
export class Nudge {
	private constructor(
		private readonly _id: number,
		private readonly _senderId: string,
		private readonly _receiverId: string,
		private readonly _todoId: number,
		private readonly _message: string | null,
		private readonly _readAt: Date | null,
		private readonly _createdAt: Date,
	) {}

	static reconstitute(props: NudgeProps): Nudge {
		return new Nudge(
			props.id,
			props.senderId,
			props.receiverId,
			props.todoId,
			props.message,
			props.readAt,
			props.createdAt,
		);
	}

	get id(): number {
		return this._id;
	}

	get senderId(): string {
		return this._senderId;
	}

	get receiverId(): string {
		return this._receiverId;
	}

	get todoId(): number {
		return this._todoId;
	}

	get message(): string | null {
		return this._message;
	}

	get readAt(): Date | null {
		return this._readAt;
	}

	get createdAt(): Date {
		return this._createdAt;
	}

	isRead(): boolean {
		return this._readAt !== null;
	}

	isReceivedBy(userId: string): boolean {
		return this._receiverId === userId;
	}
}
