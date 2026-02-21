import { NotificationBuilder } from "@test/builders";
import { NotificationMapper } from "./notification.mapper";

describe("NotificationMapper", () => {
	describe("toDto", () => {
		it("기본 알림을 DTO로 변환한다", () => {
			// Given
			const notification = NotificationBuilder.create("user-1").build();

			// When
			const result = NotificationMapper.toDto(notification);

			// Then
			expect(result.id).toBe(notification.id);
			expect(result.userId).toBe("user-1");
			expect(result.type).toBe(notification.type);
			expect(result.title).toBe(notification.title);
			expect(result.body).toBe(notification.body);
			expect(result.isRead).toBe(false);
			expect(typeof result.createdAt).toBe("string");
			expect(result.readAt).toBeNull();
		});

		it("todoId가 있으면 context에 포함한다", () => {
			// Given
			const notification = NotificationBuilder.create("user-1")
				.withTodoId(42)
				.build();

			// When
			const result = NotificationMapper.toDto(notification);

			// Then
			expect(result.context).toBeDefined();
			expect(result.context?.todoId).toBe(42);
		});

		it("nudgeId가 있으면 context에 포함한다", () => {
			// Given
			const notification = NotificationBuilder.create("user-1")
				.asNudgeReceived("friend-1", 7)
				.build();

			// When
			const result = NotificationMapper.toDto(notification);

			// Then
			expect(result.context).toBeDefined();
			expect(result.context?.nudgeId).toBe(7);
		});

		it("cheerId가 있으면 context에 포함한다", () => {
			// Given
			const notification = NotificationBuilder.create("user-1")
				.asCheerReceived("friend-1", 3)
				.build();

			// When
			const result = NotificationMapper.toDto(notification);

			// Then
			expect(result.context).toBeDefined();
			expect(result.context?.cheerId).toBe(3);
		});

		it("context 필드가 모두 null이면 context를 포함하지 않는다", () => {
			// Given
			const notification = NotificationBuilder.create("user-1").build();
			notification.todoId = null;
			notification.friendId = null;
			notification.nudgeId = null;
			notification.cheerId = null;

			// When
			const result = NotificationMapper.toDto(notification);

			// Then
			expect(result.context).toBeUndefined();
		});
	});

	describe("toDtoList", () => {
		it("알림 배열을 DTO 배열로 변환한다", () => {
			// Given
			const notifications = [
				NotificationBuilder.create("user-1").withId(1).build(),
				NotificationBuilder.create("user-1").withId(2).build(),
				NotificationBuilder.create("user-1").withId(3).build(),
			];

			// When
			const result = NotificationMapper.toDtoList(notifications);

			// Then
			expect(result).toHaveLength(3);
		});
	});
});
