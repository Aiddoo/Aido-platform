import { AggregateRoot } from "@/shared/domain";
import { CategoryColor } from "../value-objects/category-color.vo";
import { CategoryName } from "../value-objects/category-name.vo";

export interface TodoCategoryProps {
	id: number;
	userId: string;
	name: string;
	color: string;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * TodoCategory — 할 일 카테고리 애그리게잇.
 *
 * 사용자 소유의 카테고리 한 건을 나타내며 소유권 판별을 캡슐화한다. 세터는 없다(불변 조회 모델).
 * 이름·색상 불변식은 CategoryName·CategoryColor VO가, 정렬 재배치 계획은 category-reorder 도메인
 * 서비스가 소유한다.
 */
export class TodoCategory extends AggregateRoot<{
	id: number;
	userId: string;
	name: CategoryName;
	color: CategoryColor;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date;
}> {
	private constructor(props: {
		id: number;
		userId: string;
		name: CategoryName;
		color: CategoryColor;
		sortOrder: number;
		createdAt: Date;
		updatedAt: Date;
	}) {
		super(props);
	}

	static reconstitute(props: TodoCategoryProps): TodoCategory {
		return new TodoCategory({
			...props,
			name: CategoryName.of(props.name),
			color: CategoryColor.of(props.color),
			createdAt: new Date(props.createdAt),
			updatedAt: new Date(props.updatedAt),
		});
	}

	get id(): number {
		return this.props.id;
	}

	get userId(): string {
		return this.props.userId;
	}

	get name(): string {
		return this.props.name.value;
	}

	get color(): string {
		return this.props.color.value;
	}

	get sortOrder(): number {
		return this.props.sortOrder;
	}

	get createdAt(): Date {
		return new Date(this.props.createdAt);
	}

	get updatedAt(): Date {
		return new Date(this.props.updatedAt);
	}

	updateDetails(changes: { name?: string; color?: string }): void {
		if (changes.name !== undefined) {
			this.props.name = CategoryName.of(changes.name);
		}
		if (changes.color !== undefined) {
			this.props.color = CategoryColor.of(changes.color);
		}
	}

	isOwnedBy(userId: string): boolean {
		return this.props.userId === userId;
	}
}
