/**
 * TodoItem 자식 엔티티 단위 테스트
 *
 * GWT 패턴 — 제목 불변식(TodoTitle 공유)·완료 전이·저장 스냅샷 검증
 */

import { ErrorCode } from "@aido/errors";
import { DomainException } from "@/shared/domain";
import { TodoItem, type TodoItemProps } from "./todo-item.entity";

function buildProps(overrides: Partial<TodoItemProps> = {}): TodoItemProps {
	return {
		id: 10,
		title: "하위 항목",
		completed: false,
		sortOrder: 0,
		createdAt: new Date("2026-02-20T00:00:00.000Z"),
		updatedAt: new Date("2026-02-20T00:00:00.000Z"),
		...overrides,
	};
}

describe("TodoItem — 하위 항목 자식 엔티티", () => {
	describe("reconstitute", () => {
		it("DB 행 프로퍼티를 그대로 복원한다", () => {
			// Given & When
			const item = TodoItem.reconstitute(buildProps({ sortOrder: 3 }));

			// Then
			expect(item.getId()).toBe(10);
			expect(item.getTitle()).toBe("하위 항목");
			expect(item.isCompleted()).toBe(false);
			expect(item.getSortOrder()).toBe(3);
		});
	});

	describe("rename", () => {
		it("제목을 변경한다", () => {
			// Given
			const item = TodoItem.reconstitute(buildProps());

			// When
			item.rename("새 제목");

			// Then
			expect(item.getTitle()).toBe("새 제목");
		});

		it("제목이 201자면 DomainException(SYS_0002)을 던지고 상태를 바꾸지 않는다 (TodoTitle 불변식)", () => {
			// Given
			const item = TodoItem.reconstitute(buildProps({ title: "이전 제목" }));
			const rename = () => item.rename("가".repeat(201));

			// When & Then
			expect(rename).toThrow(DomainException);
			expect(rename).toThrow("제목은 1~200자여야 합니다.");
			try {
				rename();
			} catch (error) {
				if (error instanceof DomainException) {
					expect(error.errorCode).toBe(ErrorCode.SYS_0002);
				}
			}
			expect(item.getTitle()).toBe("이전 제목");
		});

		it("빈 제목이면 DomainException(SYS_0002)을 던진다", () => {
			// Given
			const item = TodoItem.reconstitute(buildProps());

			// When & Then
			expect(() => item.rename("")).toThrow(DomainException);
		});
	});

	describe("setCompleted", () => {
		it("완료 상태를 설정한다", () => {
			// Given
			const item = TodoItem.reconstitute(buildProps({ completed: false }));

			// When
			item.setCompleted(true);

			// Then
			expect(item.isCompleted()).toBe(true);
		});

		it("미완료로 되돌릴 수 있다", () => {
			// Given
			const item = TodoItem.reconstitute(buildProps({ completed: true }));

			// When
			item.setCompleted(false);

			// Then
			expect(item.isCompleted()).toBe(false);
		});
	});

	describe("toPersistence", () => {
		it("가변 필드(title, completed)만 담은 저장용 스냅샷을 반환한다", () => {
			// Given
			const item = TodoItem.reconstitute(buildProps());
			item.rename("수정된 항목");
			item.setCompleted(true);

			// When
			const snapshot = item.toPersistence();

			// Then - id/sortOrder/타임스탬프는 미포함
			expect(snapshot).toEqual({ title: "수정된 항목", completed: true });
		});
	});
});
