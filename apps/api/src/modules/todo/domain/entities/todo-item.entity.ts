import { Entity } from "@/common/domain";
import { TodoTitle } from "../value-objects/todo-title.vo";

/**
 * 하위 항목 엔티티 프로퍼티
 */
export interface TodoItemProps {
	id: number;
	title: string;
	completed: boolean;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Todo 하위 항목 자식 엔티티
 *
 * Todo 애그리게잇 내부에서만 생성·변경됩니다. 외부(핸들러)는 애그리게잇의
 * 행동 메서드(renameItem/setItemCompleted/removeItem)를 통해서만 접근합니다.
 * 제목 불변식은 TodoTitle VO가 소유합니다(부모 제목과 동일 규칙, Zod 경계와 일치).
 */
export class TodoItem extends Entity<TodoItemProps> {
	private constructor(props: TodoItemProps) {
		super(props);
	}

	/** DB 행에서 복원합니다(불변식 재검증 없음 — Todo.reconstitute와 같은 원칙). */
	static reconstitute(props: TodoItemProps): TodoItem {
		return new TodoItem(props);
	}

	/** 제목을 변경합니다 — TodoTitle 불변식 위반 시 DomainException. */
	rename(title: string): void {
		TodoTitle.create(title);
		this.props.title = title;
	}

	/** 완료 상태를 설정합니다. */
	setCompleted(completed: boolean): void {
		this.props.completed = completed;
	}

	getId(): number {
		return this.props.id;
	}

	getTitle(): string {
		return this.props.title;
	}

	isCompleted(): boolean {
		return this.props.completed;
	}

	getSortOrder(): number {
		return this.props.sortOrder;
	}

	/** 저장용 스냅샷(가변 필드만) — 핸들러가 엔티티 상태를 단일 소스로 영속화합니다. */
	toPersistence(): { title: string; completed: boolean } {
		return {
			title: this.props.title,
			completed: this.props.completed,
		};
	}
}
