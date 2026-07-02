import { now } from "@/common/date/utils/core";
import { AggregateRoot } from "@/common/domain";
import type { TodoWithCategory } from "../../types/todo.types";
import { TodoCreatedEvent } from "../events/todo-created.event";
import { TodoToggledEvent } from "../events/todo-toggled.event";

/**
 * Todo 애그리게잇 프로퍼티
 *
 * 조회 시 카테고리/하위 항목 스냅샷을 함께 보유해, 매퍼가 기존 응답 형식을
 * 그대로 생성할 수 있게 합니다(응답 계약 무변경).
 */
export type TodoProps = TodoWithCategory;

/**
 * Todo 애그리게잇 루트
 *
 * 완료 상태 전이 등 비즈니스 불변식과 상태 변화를 담당합니다.
 * 영속성(행 매핑)은 인프라 어댑터가, 응답 변환은 매퍼가 담당합니다.
 */
export class Todo extends AggregateRoot<TodoProps> {
	private constructor(props: TodoProps) {
		super(props);
	}

	/**
	 * DB 행으로부터 애그리게잇을 복원합니다(불변식 재검증 없음).
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
				this.props.id,
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
				this.props.id,
				this.props.userId,
				completed,
				timezone,
			),
		);
	}

	getId(): number {
		return this.props.id;
	}

	getUserId(): string {
		return this.props.userId;
	}

	isCompleted(): boolean {
		return this.props.completed;
	}

	/**
	 * 매퍼/영속성용 스냅샷을 반환합니다.
	 */
	getSnapshot(): TodoWithCategory {
		return this.props;
	}
}
