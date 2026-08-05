import { ErrorCode } from "@aido/errors";
import { TODO_ITEM_LIMITS } from "@aido/validators";
import { AggregateRoot, DomainException } from "@/shared/domain";
import { now } from "@/shared/domain/date/utils/core";
import { TodoCategoryChangedEvent } from "../events/todo-category-changed.event";
import { TodoCreatedEvent } from "../events/todo-created.event";
import { TodoDeletedEvent } from "../events/todo-deleted.event";
import { TodoRescheduledEvent } from "../events/todo-rescheduled.event";
import { TodoToggledEvent } from "../events/todo-toggled.event";
import { TodoUpdatedEvent } from "../events/todo-updated.event";
import { TodoVisibilityChangedEvent } from "../events/todo-visibility-changed.event";
import { TodoId } from "../value-objects/todo-id.vo";
import {
	TodoSchedule,
	type TodoScheduleProps,
} from "../value-objects/todo-schedule.vo";
import { TodoTitle } from "../value-objects/todo-title.vo";
import type { TodoItem } from "./todo-item.entity";

export type TodoVisibility = "PUBLIC" | "PRIVATE";

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
 * 생성 초안 (`Todo.planCreation()` 반환 타입 — sortOrder 미정)
 *
 * id가 DB autoincrement라 영속화 전에 애그리게잇을 만들 수 없어,
 * 생성 불변식(제목)·기본값 파생을 도메인이 담당하고 저장 데이터를 초안으로
 * 반환합니다. sortOrder는 TX 안에서 결정되므로 핸들러가 나중에 붙입니다.
 */
export interface TodoCreationDraft {
	userId: string;
	categoryId: number;
	title: string;
	startDate: Date;
	endDate?: Date | null;
	scheduledTime?: Date | null;
	isAllDay: boolean;
	visibility: TodoVisibility;
}

/** 영속화 직전의 완성된 생성 계획 (초안 + TX 내 결정된 sortOrder) */
export interface TodoCreationPlan extends TodoCreationDraft {
	sortOrder: number;
}

/** `Todo.planCreation()` 입력 (기본값 파생 전) */
export interface TodoCreationInput {
	userId: string;
	categoryId: number;
	title: string;
	startDate: Date;
	endDate?: Date | null;
	scheduledTime?: Date | null;
	isAllDay?: boolean;
	visibility?: TodoVisibility;
}

/**
 * 저장용 상태 스냅샷 (`Todo.toPersistence()` 반환 타입)
 *
 * 애그리게잇의 가변 필드만 담습니다. id/userId/sortOrder/items는
 * 각자의 전용 경로(생성·reorder·item 유스케이스)로만 변경됩니다.
 */
export interface TodoPersistenceSnapshot {
	title: string;
	categoryId: number;
	startDate: Date;
	endDate: Date | null;
	scheduledTime: Date | null;
	isAllDay: boolean;
	visibility: TodoVisibility;
	completed: boolean;
	completedAt: Date | null;
}

/**
 * Todo 애그리게잇 프로퍼티 (순수 쓰기 모델)
 *
 * - 일정은 TodoSchedule VO로 저장해 날짜 불변식이 타입 수준에서 보장됩니다.
 * - 하위 항목은 TodoItem 자식 엔티티로 보유하며, 항목 불변식(개수 한도·제목·
 *   존재)은 애그리게잇 행동 메서드가 소유합니다.
 * - 카테고리 name/color 등 타 애그리게잇의 read model은 담지 않고
 *   `categoryId` 참조만 보유합니다.
 */
export interface TodoProps {
	id: TodoId;
	userId: string;
	title: string;
	categoryId: number;
	sortOrder: number;
	completed: boolean;
	completedAt: Date | null;
	schedule: TodoSchedule;
	visibility: TodoVisibility;
	recurrenceGroupId: string | null;
	items: TodoItem[];
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Todo 애그리게잇 루트
 *
 * 완료 상태 전이·일정·하위 항목 등 비즈니스 불변식과 상태 변화를 담당합니다.
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
	 * TodoId를 만들 수 없습니다. 생성은 `planCreation()`(불변식·기본값) →
	 * 리포지토리 create → reconstitute → `markCreated()` 순서가 의도된 선택입니다.
	 * (id 전략을 UUID 등 도메인 생성으로 바꾸는 것은 별도 논의)
	 */
	static reconstitute(props: TodoProps): Todo {
		return new Todo(props);
	}

	/**
	 * 생성 초안을 수립합니다 — 생성 불변식(제목)과 기본값 파생의 단일 지점.
	 *
	 * 모든 생성 경로(단건·반복·메모 변환)가 이 팩토리를 통과해야 합니다.
	 * sortOrder는 TX 안에서 결정되므로 핸들러가 초안에 붙여 계획을 완성합니다.
	 */
	static planCreation(input: TodoCreationInput): TodoCreationDraft {
		TodoTitle.create(input.title);
		// 생성 시점에도 일정 불변식(endDate >= startDate) 강제 — 도메인 자기방어
		TodoSchedule.create({
			startDate: input.startDate,
			endDate: input.endDate ?? null,
			scheduledTime: input.scheduledTime ?? null,
			isAllDay: input.isAllDay ?? true,
		});

		return {
			userId: input.userId,
			categoryId: input.categoryId,
			title: input.title,
			startDate: input.startDate,
			endDate: input.endDate,
			scheduledTime: input.scheduledTime,
			isAllDay: input.isAllDay ?? true,
			visibility: input.visibility ?? "PUBLIC",
		};
	}

	/**
	 * 생성 완료를 표시합니다.
	 *
	 * 리마인더 스케줄링 등 생성 부수효과 트리거로 TodoCreatedEvent를 적립합니다.
	 */
	markCreated(): void {
		this.raise(
			new TodoCreatedEvent(
				this.props.id.getValue(),
				this.props.userId,
				this.props.schedule.getScheduledTime(),
			),
		);
	}

	/**
	 * 완료 상태를 토글합니다.
	 *
	 * 완료로 전환 시 completedAt을 현재 시각으로, 미완료로 전환 시 null로 설정하고
	 * TodoToggledEvent를 적립합니다(부수효과는 커밋 후 이벤트 핸들러가 처리).
	 *
	 * @returns 실제 상태 전이 여부. 같은 값 재토글이면 상태·이벤트 모두 변화 없이
	 *          false를 반환합니다(스트릭/알림 재발화 억제 — 응답 계약은 핸들러가 유지).
	 */
	toggleComplete(completed: boolean, timezone: string): boolean {
		if (this.props.completed === completed) {
			return false;
		}

		this.props.completed = completed;
		this.props.completedAt = completed ? now() : null;

		this.raise(
			new TodoToggledEvent(
				this.props.id.getValue(),
				this.props.userId,
				completed,
				timezone,
			),
		);
		return true;
	}

	/**
	 * 부분 수정을 적용합니다 (PATCH /todos/:id).
	 *
	 * - undefined 필드는 변경하지 않습니다.
	 * - 일정 필드는 TodoSchedule.patch가 머지·검증을 원자적으로 수행합니다
	 *   (단일 필드 패치에서도 endDate >= startDate 교차 검증).
	 * - 완료 상태는 이전 상태와 **다를 때만** 전이하며 completedAt을 함께 파생합니다.
	 *   (같은 값으로 재요청 시 completedAt 불변 — 레거시 동작 보존)
	 * - TodoUpdatedEvent에는 전이 후 완료 **상태**(사실)를 싣습니다. 완료 상태(true)면
	 *   커밋 후 이벤트 핸들러가 리마인더를 취소합니다(완료 todo에는 리마인더가 없어
	 *   멱등). 스트릭·마일스톤은 토글 전용이므로 발생하지 않습니다.
	 */
	updateDetails(patch: TodoDetailsPatch): void {
		if (Object.values(patch).every((value) => value === undefined)) {
			return;
		}

		// 검증을 모두 통과한 뒤에만 상태를 변경합니다 (부분 변경 방지)
		if (patch.title !== undefined) {
			TodoTitle.create(patch.title);
		}
		const schedulePatch: Partial<TodoScheduleProps> = {};
		if (patch.startDate !== undefined) {
			schedulePatch.startDate = patch.startDate;
		}
		if (patch.endDate !== undefined) {
			schedulePatch.endDate = patch.endDate;
		}
		if (patch.scheduledTime !== undefined) {
			schedulePatch.scheduledTime = patch.scheduledTime;
		}
		if (patch.isAllDay !== undefined) {
			schedulePatch.isAllDay = patch.isAllDay;
		}
		const nextSchedule =
			Object.keys(schedulePatch).length > 0
				? this.props.schedule.patch(schedulePatch)
				: null;

		if (patch.title !== undefined) {
			this.props.title = patch.title;
		}
		if (patch.categoryId !== undefined) {
			this.props.categoryId = patch.categoryId;
		}
		if (nextSchedule) {
			this.props.schedule = nextSchedule;
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

		this.raise(
			new TodoUpdatedEvent(
				this.props.id.getValue(),
				this.props.userId,
				this.props.completed,
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
		this.props.schedule = schedule;

		this.raise(
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
		this.raise(
			new TodoDeletedEvent(this.props.id.getValue(), this.props.userId),
		);
	}

	/**
	 * 공개 범위를 변경합니다 (PATCH /todos/:id/visibility).
	 *
	 * 친구 공개 투두와 일별 완료 현황의 공개 범위가 달라지므로,
	 * TodoVisibilityChangedEvent를 적립해 공개 캐시 무효화를 트리거합니다.
	 */
	changeVisibility(visibility: TodoVisibility): void {
		this.props.visibility = visibility;
		this.raise(
			new TodoVisibilityChangedEvent(
				this.props.id.getValue(),
				this.props.userId,
			),
		);
	}

	/**
	 * 카테고리를 변경합니다 (PATCH /todos/:id/category).
	 *
	 * 소유권·활성 여부 검증은 애플리케이션 계층(포트) 책임입니다.
	 * 일별 완료 통계가 할 일의 카테고리 색상을 집계하므로, 카테고리 변경은
	 * TodoCategoryChangedEvent를 적립해 daily-completion 캐시 무효화를 트리거합니다
	 * (부수효과는 커밋 후 크로스모듈 @OnEvent 구독자가 처리).
	 */
	changeCategory(categoryId: number): void {
		this.props.categoryId = categoryId;
		this.raise(
			new TodoCategoryChangedEvent(
				this.props.id.getValue(),
				this.props.userId,
				categoryId,
			),
		);
	}

	// ── 하위 항목 (자식 엔티티) ───────────────────────────────────────────

	/**
	 * 하위 항목 추가를 계획합니다 (POST /todos/:id/items).
	 *
	 * MAX_PER_TODO 개수 불변식과 제목 불변식을 애그리게잇이 소유합니다.
	 * 항목 id가 DB autoincrement라 planCreation과 같은 계획 패턴을 사용하며,
	 * 리포지토리가 계획을 영속화합니다. 동시 추가 레이스 특성은 기존
	 * in-TX count 방식과 동등합니다(read committed — 애그리게잇을 TX 안에서
	 * 로드하는 전제).
	 */
	planItemAddition(title: string): { title: string; sortOrder: number } {
		TodoTitle.create(title);

		if (this.props.items.length >= TODO_ITEM_LIMITS.MAX_PER_TODO) {
			throw new DomainException(ErrorCode.TODO_0821, {
				currentCount: this.props.items.length,
				maxPerTodo: TODO_ITEM_LIMITS.MAX_PER_TODO,
			});
		}

		const maxSortOrder = this.props.items.reduce(
			(max, item) => Math.max(max, item.getSortOrder()),
			-1,
		);
		return { title, sortOrder: maxSortOrder + 1 };
	}

	/**
	 * 하위 항목을 부분 수정합니다 (PATCH /todos/:id/items/:itemId).
	 *
	 * 존재하지 않는 항목이면 DomainException(TODO_0822).
	 * 변경된 항목 엔티티를 반환하며, 핸들러는 그 상태를 영속화합니다.
	 */
	updateItem(
		itemId: number,
		patch: { title?: string; completed?: boolean },
	): TodoItem {
		const item = this.#requireItem(itemId);
		if (patch.title !== undefined) {
			item.rename(patch.title);
		}
		if (patch.completed !== undefined) {
			item.setCompleted(patch.completed);
		}
		return item;
	}

	/** 하위 항목을 제거합니다 — 존재하지 않으면 DomainException(TODO_0822). */
	removeItem(itemId: number): void {
		this.#requireItem(itemId);
		this.props.items = this.props.items.filter(
			(item) => item.getId() !== itemId,
		);
	}

	/**
	 * 하위 항목 순서 일괄 변경을 검증합니다 (PATCH /todos/:id/items/reorder).
	 *
	 * 전체 항목 ID 집합 일치를 요구합니다 — 부분 전달 시 sortOrder 충돌 방지.
	 * (기존 핸들러 검증을 애그리게잇으로 이관 — 에러 코드·메시지 보존)
	 */
	validateItemsReorder(itemIds: number[]): void {
		const currentIds = new Set(this.getItemIds());
		const uniqueItemIds = new Set(itemIds);
		if (uniqueItemIds.size !== itemIds.length) {
			throw new DomainException(
				ErrorCode.SYS_0002,
				{ received: itemIds.length, unique: uniqueItemIds.size },
				"중복된 하위 항목 ID가 있습니다",
			);
		}
		if (itemIds.length !== currentIds.size) {
			throw new DomainException(
				ErrorCode.SYS_0002,
				{ expected: currentIds.size, received: itemIds.length },
				"모든 하위 항목 ID를 전달해야 합니다",
			);
		}
		for (const id of itemIds) {
			if (!currentIds.has(id)) {
				throw new DomainException(ErrorCode.TODO_0822, { itemId: id });
			}
		}
	}

	#requireItem(itemId: number): TodoItem {
		const item = this.props.items.find((entry) => entry.getId() === itemId);
		if (!item) {
			throw new DomainException(ErrorCode.TODO_0822, { itemId });
		}
		return item;
	}

	// ── 조회/스냅샷 ─────────────────────────────────────────────────────

	/**
	 * 저장용 상태 스냅샷을 반환합니다.
	 *
	 * 핸들러가 커맨드 패치가 아닌 **애그리게잇 상태**를 영속화하도록 해
	 * 도메인과 저장 데이터의 이중 소스 문제를 제거합니다.
	 * Date는 방어 복사본으로 반환합니다.
	 */
	toPersistence(): TodoPersistenceSnapshot {
		const schedule = this.props.schedule.getValue();
		return {
			title: this.props.title,
			categoryId: this.props.categoryId,
			startDate: schedule.startDate,
			endDate: schedule.endDate,
			scheduledTime: schedule.scheduledTime,
			isAllDay: schedule.isAllDay,
			visibility: this.props.visibility,
			completed: this.props.completed,
			completedAt: this.props.completedAt
				? new Date(this.props.completedAt)
				: null,
		};
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
		return this.props.items.map((item) => item.getId());
	}

	hasItem(itemId: number): boolean {
		return this.props.items.some((item) => item.getId() === itemId);
	}

	isCompleted(): boolean {
		return this.props.completed;
	}

	getCompletedAt(): Date | null {
		return this.props.completedAt ? new Date(this.props.completedAt) : null;
	}
}
