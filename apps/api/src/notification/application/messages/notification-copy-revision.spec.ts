import { describe, expect, it } from "vitest";

import type { CreateNotificationData } from "../ports/notification-data.js";
import { withNotificationCopyRevision } from "./notification-copy-revision.js";

describe("알림 문구 버전", () => {
	it("템플릿 알림에는 버전을 기록하고 기존 메타데이터와 입력을 유지한다", () => {
		// Given
		const data: CreateNotificationData = {
			userId: "user",
			type: "TODO_REMINDER",
			title: "할 시간이에요",
			body: "산책부터 시작해볼까?",
			campaignKey: "todo_reminder_v1",
			variantId: "todo_reminder_v1.v1",
			metadata: { stage: "immediate", message: "친구가 직접 쓴 글" },
		};

		// When
		const result = withNotificationCopyRevision(data);

		// Then
		expect(result.metadata).toEqual({
			stage: "immediate",
			message: "친구가 직접 쓴 글",
			copyRevision: "1.11.0",
		});
		expect(data.metadata).toEqual({ stage: "immediate", message: "친구가 직접 쓴 글" });
		expect(result.campaignKey).toBe(data.campaignKey);
		expect(result.variantId).toBe(data.variantId);
	});

	it("직접 작성한 공지에는 템플릿 문구 버전을 붙이지 않는다", () => {
		// Given
		const data: CreateNotificationData = {
			userId: "user",
			type: "SYSTEM_NOTICE",
			title: "공지",
			body: "직접 작성한 글",
		};

		// When
		const result = withNotificationCopyRevision(data);

		// Then
		expect(result).toBe(data);
		expect(result.metadata).toBeUndefined();
	});
});
