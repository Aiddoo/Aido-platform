import {
	createRetentionNotificationMessage,
	type RetentionNotificationInput,
} from "./messages/retention-notification-message";

const context = (user: number) => ({
	recipientId: `user-${user}`,
	occurrenceKey: "2026-08-28",
});

describe("createRetentionNotificationMessage", () => {
	it("같은 사용자·단계·날짜는 재시도에도 같은 copy를 반환한다", () => {
		const input: RetentionNotificationInput = {
			stage: "D1",
			copyKey: "d1_no_todo",
			locale: "ko",
			selectionContext: context(1),
		};
		const first = createRetentionNotificationMessage(input);
		const retry = createRetentionNotificationMessage(input);

		expect(retry).toEqual(first);
		expect(first.variantId).toMatch(/^d1_no_todo\.v[1-3]$/);
	});

	it("여러 사용자에게 둘 이상의 variant를 안정적으로 분산한다", () => {
		const messages = Array.from({ length: 30 }, (_, user) =>
			createRetentionNotificationMessage({
				stage: "D3",
				copyKey: "d3_restart",
				selectionContext: context(user),
			}),
		);

		expect(new Set(messages.map(({ variantId }) => variantId)).size).toBeGreaterThan(1);
	});

	it("ko/en은 같은 variant를 고르고 copy만 현지화한다", () => {
		const korean = createRetentionNotificationMessage({
			stage: "D7",
			copyKey: "d7_has_progress",
			locale: "ko",
			selectionContext: context(1),
		});
		const english = createRetentionNotificationMessage({
			stage: "D7",
			copyKey: "d7_has_progress",
			locale: "en",
			selectionContext: context(1),
		});

		expect(english.variantId).toBe(korean.variantId);
		expect(english.title).not.toBe(korean.title);
	});

	it("stage와 copyKey의 불가능한 조합은 컴파일되지 않는다", () => {
		if (false) {
			// @ts-expect-error D0에는 d7_restart가 존재하지 않는다.
			createRetentionNotificationMessage({
				stage: "D0",
				copyKey: "d7_restart",
				selectionContext: context(1),
			});
		}

		expect(true).toBe(true);
	});
});
