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
export class Nudge extends AggregateRoot<NudgeProps> {
	static reconstitute(props: NudgeProps): Nudge {
		return new Nudge({
			...props,
			readAt: props.readAt ? new Date(props.readAt) : null,
			createdAt: new Date(props.createdAt),
		});
	}

	get id(): number {
		return this.props.id;
	}

	get senderId(): string {
		return this.props.senderId;
	}

	get receiverId(): string {
		return this.props.receiverId;
	}

	get todoId(): number {
		return this.props.todoId;
	}

	get message(): string | null {
		return this.props.message;
	}

	get readAt(): Date | null {
		return this.props.readAt ? new Date(this.props.readAt) : null;
	}

	get createdAt(): Date {
		return new Date(this.props.createdAt);
	}

	isRead(): boolean {
		return this.props.readAt !== null;
	}

	isReceivedBy(userId: string): boolean {
		return this.props.receiverId === userId;
	}
}

import { AggregateRoot } from "@/shared/domain";
