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
export class TodoCategory {
	private constructor(
		private readonly _id: number,
		private readonly _userId: string,
		private readonly _name: string,
		private readonly _color: string,
		private readonly _sortOrder: number,
		private readonly _createdAt: Date,
		private readonly _updatedAt: Date,
	) {}

	static reconstitute(props: TodoCategoryProps): TodoCategory {
		return new TodoCategory(
			props.id,
			props.userId,
			props.name,
			props.color,
			props.sortOrder,
			props.createdAt,
			props.updatedAt,
		);
	}

	get id(): number {
		return this._id;
	}

	get userId(): string {
		return this._userId;
	}

	get name(): string {
		return this._name;
	}

	get color(): string {
		return this._color;
	}

	get sortOrder(): number {
		return this._sortOrder;
	}

	get createdAt(): Date {
		return this._createdAt;
	}

	get updatedAt(): Date {
		return this._updatedAt;
	}

	isOwnedBy(userId: string): boolean {
		return this._userId === userId;
	}
}
