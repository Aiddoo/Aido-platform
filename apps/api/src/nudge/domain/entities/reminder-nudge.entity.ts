export interface ReminderNudgeProps {
	id: number;
	senderId: string;
	receiverId: string;
	message: string | null;
	createdAt: Date;
}

/**
 * ReminderNudge — 리마인드 콕 찌르기 애그리게잇.
 *
 * 친구가 오늘 할 일을 만들지 않았을 때 보내는 독촉 콕 찌르기 한 건을 나타낸다.
 * 특정 할 일에 묶이지 않으며(todoId 없음), 쿨다운 판정을 위한 생성 시각을 소유한다. 세터는 없다.
 */
export class ReminderNudge {
	private constructor(
		private readonly _id: number,
		private readonly _senderId: string,
		private readonly _receiverId: string,
		private readonly _message: string | null,
		private readonly _createdAt: Date,
	) {}

	static reconstitute(props: ReminderNudgeProps): ReminderNudge {
		return new ReminderNudge(
			props.id,
			props.senderId,
			props.receiverId,
			props.message,
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

	get createdAt(): Date {
		return this._createdAt;
	}
}
