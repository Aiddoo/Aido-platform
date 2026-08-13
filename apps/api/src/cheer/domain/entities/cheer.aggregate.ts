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
export class Cheer extends AggregateRoot<CheerProps> {
	static reconstitute(props: CheerProps): Cheer {
		return new Cheer({
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
