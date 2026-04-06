import type { Memo } from "@/generated/prisma/client";

export class MemoBuilder {
	private data: Memo;
	private static idCounter = 0;

	private constructor(userId: string) {
		const now = new Date();
		MemoBuilder.idCounter += 1;
		this.data = {
			id: MemoBuilder.idCounter,
			userId,
			content: "테스트 메모",
			isPinned: false,
			sortOrder: 0,
			createdAt: now,
			updatedAt: now,
		};
	}

	static create(userId: string): MemoBuilder {
		return new MemoBuilder(userId);
	}

	static resetIdCounter(): void {
		MemoBuilder.idCounter = 0;
	}

	withId(id: number): this {
		this.data.id = id;
		return this;
	}

	withContent(content: string): this {
		this.data.content = content;
		return this;
	}

	pinned(): this {
		this.data.isPinned = true;
		return this;
	}

	withSortOrder(order: number): this {
		this.data.sortOrder = order;
		return this;
	}

	withCreatedAt(date: Date): this {
		this.data.createdAt = date;
		return this;
	}

	build(): Memo {
		return { ...this.data };
	}
}
