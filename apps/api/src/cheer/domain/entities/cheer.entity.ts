export interface CheerProps {
	id: number;
	senderId: string;
	receiverId: string;
	message: string | null;
	readAt: Date | null;
	createdAt: Date;
}

/**
 * Cheer — 응원 애그리게잇.
 *
 * 한 건의 응원(발신자→수신자, 선택적 메시지)을 나타내며, 읽음 여부·수신자 소유 판별 등
 * 응원에 관한 규칙을 캡슐화한다. 세터는 없다(불변 조회 모델).
 */
export class Cheer {
	private constructor(
		private readonly _id: number,
		private readonly _senderId: string,
		private readonly _receiverId: string,
		private readonly _message: string | null,
		private readonly _readAt: Date | null,
		private readonly _createdAt: Date,
	) {}

	static reconstitute(props: CheerProps): Cheer {
		return new Cheer(
			props.id,
			props.senderId,
			props.receiverId,
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
