import { now } from "@/common/date/utils/core";
import { AggregateRoot } from "@/common/domain";
import { TodoCreatedEvent } from "../events/todo-created.event";
import { TodoToggledEvent } from "../events/todo-toggled.event";
import { TodoId } from "../value-objects/todo-id.vo";

export type TodoVisibility = "PUBLIC" | "PRIVATE";

/**
 * 하위 항목 도메인 스냅샷
 *
 * 애그리게잇 내부 값. 응답 read model이 아니라 도메인 상태의 일부입니다.
 */
export interface TodoItemSnapshot {
	id: number;
	title: string;
	completed: boolean;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Todo 애그리게잇 프로퍼티 (순수 쓰기 모델)
 *
 * 카테고리 name/color 등 타 애그리게잇의 read model은 담지 않고 `categoryId` 참조만 보유합니다.
 * 조회 응답(카테고리 정보·itemStats)은 읽기 포트/read model이 별도로 담당합니다.
 */
export interface TodoProps {
	id: TodoId;
	userId: string;
	title: string;
	categoryId: number;
	sortOrder: number;
	completed: boolean;
	completedAt: Date | null;
	startDate: Date;
	endDate: Date | null;
	scheduledTime: Date | null;
	isAllDay: boolean;
	visibility: TodoVisibility;
	recurrenceGroupId: string | null;
	items: TodoItemSnapshot[];
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Todo 애그리게잇 루트
 *
 * 완료 상태 전이 등 비즈니스 불변식과 상태 변화를 담당합니다.
 * 영속성(행 매핑)은 인프라 어댑터가, 조회 응답 변환은 읽기 어댑터가 담당합니다.
 */
export class Todo extends AggregateRoot<TodoProps> {
	private constructor(props: TodoProps) {
		super(props);
	}

	/**
	 * DB 행에서 매핑된 도메인 props로 애그리게잇을 복원합니다(불변식 재검증 없음).
	 */
	static reconstitute(props: TodoProps): Todo {
		return new Todo(props);
	}

	/**
	 * 생성 완료를 표시합니다.
	 *
	 * 리마인더 스케줄링 등 생성 부수효과 트리거로 TodoCreatedEvent를 적립합니다.
	 */
	markCreated(): void {
		this.apply(
			new TodoCreatedEvent(
				this.props.id.getValue(),
				this.props.userId,
				this.props.scheduledTime,
			),
		);
	}

	/**
	 * 완료 상태를 토글합니다.
	 *
	 * 완료로 전환 시 completedAt을 현재 시각으로, 미완료로 전환 시 null로 설정하고
	 * TodoToggledEvent를 적립합니다(부수효과는 커밋 후 이벤트 핸들러가 처리).
	 */
	toggleComplete(completed: boolean, timezone: string): void {
		this.props.completed = completed;
		this.props.completedAt = completed ? now() : null;

		this.apply(
			new TodoToggledEvent(
				this.props.id.getValue(),
				this.props.userId,
				completed,
				timezone,
			),
		);
	}

	getId(): TodoId {
		return this.props.id;
	}

	getUserId(): string {
		return this.props.userId;
	}

	isCompleted(): boolean {
		return this.props.completed;
	}

	getCompletedAt(): Date | null {
		return this.props.completedAt;
	}
}
