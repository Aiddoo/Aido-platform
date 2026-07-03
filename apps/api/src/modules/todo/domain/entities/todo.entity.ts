import { ErrorCode } from "@aido/errors";
import { now } from "@/common/date/utils/core";
import { AggregateRoot, DomainException } from "@/common/domain";
import { TodoCreatedEvent } from "../events/todo-created.event";
import { TodoDeletedEvent } from "../events/todo-deleted.event";
import { TodoRescheduledEvent } from "../events/todo-rescheduled.event";
import { TodoToggledEvent } from "../events/todo-toggled.event";
import { TodoUpdatedEvent } from "../events/todo-updated.event";
import { TodoId } from "../value-objects/todo-id.vo";
import type { TodoSchedule } from "../value-objects/todo-schedule.vo";

export type TodoVisibility = "PUBLIC" | "PRIVATE";

/** 제목 불변식 (Zod 경계 검증과 동일 규칙 — 도메인 자기방어) */
const TITLE_MIN_LENGTH = 1;
const TITLE_MAX_LENGTH = 200;

/**
 * Todo 부분 수정 패치 (도메인 관점)
 *
 * undefined 필드는 "변경하지 않음"을 의미합니다.
 * completedAt은 완료 상태 전이에서 파생되므로 패치에 포함하지 않습니다.
 */
export interface TodoDetailsPatch {
	title?: string;
	categoryId?: number;
	startDate?: Date;
	endDate?: Date | null;
	scheduledTime?: Date | null;
	isAllDay?: boolean;
	visibility?: TodoVisibility;
	completed?: boolean;
}

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
	 *
	 * `static create()` 팩토리가 없는 이유: id가 DB autoincrement라 영속화 전에
	 * TodoId를 만들 수 없습니다. 생성은 리포지토리 create → reconstitute →
	 * `markCreated()`로 생성 이벤트를 적립하는 방식이 의도된 선택입니다.
	 * (id 전략을 UUID 등 도메인 생성으로 바꾸는 것은 별도 논의)
	 */
	static reconstitute(props: TodoProps): Todo {
		return new Todo(props);
	}

	/** 제목 불변식 검증 — 위반 시 DomainException */
	static #validateTitle(title: string): void {
		if (title.length < TITLE_MIN_LENGTH || title.length > TITLE_MAX_LENGTH) {
			throw new DomainException(
				ErrorCode.SYS_0002,
				{ titleLength: title.length, max: TITLE_MAX_LENGTH },
				`제목은 ${TITLE_MIN_LENGTH}~${TITLE_MAX_LENGTH}자여야 합니다.`,
			);
		}
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

	/**
	 * 부분 수정을 적용합니다 (PATCH /todos/:id).
	 *
	 * - undefined 필드는 변경하지 않습니다.
	 * - 완료 상태는 이전 상태와 **다를 때만** 전이하며 completedAt을 함께 파생합니다.
	 *   (같은 값으로 재요청 시 completedAt 불변 — 레거시 동작 보존)
	 * - TodoUpdatedEvent를 적립합니다. 완료 요청(true)이면 커밋 후 이벤트 핸들러가
	 *   리마인더를 취소합니다. 스트릭·마일스톤은 토글 전용이므로 발생하지 않습니다.
	 */
	updateDetails(patch: TodoDetailsPatch): void {
		if (patch.title !== undefined) {
			Todo.#validateTitle(patch.title);
			this.props.title = patch.title;
		}
		if (patch.categoryId !== undefined) {
			this.props.categoryId = patch.categoryId;
		}
		if (patch.startDate !== undefined) {
			this.props.startDate = patch.startDate;
		}
		if (patch.endDate !== undefined) {
			this.props.endDate = patch.endDate;
		}
		if (patch.scheduledTime !== undefined) {
			this.props.scheduledTime = patch.scheduledTime;
		}
		if (patch.isAllDay !== undefined) {
			this.props.isAllDay = patch.isAllDay;
		}
		if (patch.visibility !== undefined) {
			this.props.visibility = patch.visibility;
		}
		if (
			patch.completed !== undefined &&
			patch.completed !== this.props.completed
		) {
			this.props.completed = patch.completed;
			this.props.completedAt = patch.completed ? now() : null;
		}

		this.apply(
			new TodoUpdatedEvent(
				this.props.id.getValue(),
				this.props.userId,
				patch.completed,
			),
		);
	}

	/**
	 * 일정을 변경합니다 (PATCH /todos/:id/schedule).
	 *
	 * TodoSchedule VO가 날짜 불변식을 보장하며,
	 * TodoRescheduledEvent를 적립합니다(커밋 후 이벤트 핸들러가 리마인더 재스케줄/취소).
	 */
	reschedule(schedule: TodoSchedule): void {
		this.props.startDate = schedule.getStartDate();
		this.props.endDate = schedule.getEndDate();
		this.props.scheduledTime = schedule.getScheduledTime();
		this.props.isAllDay = schedule.isAllDay();

		this.apply(
			new TodoRescheduledEvent(
				this.props.id.getValue(),
				this.props.userId,
				schedule.getScheduledTime(),
			),
		);
	}

	/**
	 * 삭제 완료를 표시합니다 (DELETE /todos/:id).
	 *
	 * 상태 변화 없이 TodoDeletedEvent만 적립합니다(markCreated와 대칭).
	 * 커밋 후 이벤트 핸들러가 리마인더를 취소합니다.
	 */
	markDeleted(): void {
		this.apply(
			new TodoDeletedEvent(this.props.id.getValue(), this.props.userId),
		);
	}

	getId(): TodoId {
		return this.props.id;
	}

	getUserId(): string {
		return this.props.userId;
	}

	getSortOrder(): number {
		return this.props.sortOrder;
	}

	getItemIds(): number[] {
		return this.props.items.map((item) => item.id);
	}

	hasItem(itemId: number): boolean {
		return this.props.items.some((item) => item.id === itemId);
	}

	isCompleted(): boolean {
		return this.props.completed;
	}

	getCompletedAt(): Date | null {
		return this.props.completedAt;
	}
}
