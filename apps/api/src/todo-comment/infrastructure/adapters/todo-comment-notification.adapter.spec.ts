import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import {
	createTodoCommentNotificationMessage,
	NotificationSender,
	TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY,
} from "@/notification";

import { TodoCommentNotificationAdapter } from "./todo-comment-notification.adapter";

describe("TodoCommentNotificationAdapter — 배포 앱 알림 이동 호환", () => {
	let adapter: TodoCommentNotificationAdapter;
	let notificationSender: Mocked<NotificationSender>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(TodoCommentNotificationAdapter).compile();
		adapter = unit;
		notificationSender = unitRef.get(NotificationSender);
		notificationSender.getUserLocale.mockResolvedValue("ko");
		notificationSender.createAndSend.mockResolvedValue(null);
	});

	it("댓글 알림은 서버 내부 경로 대신 의미 기반 이동 재료만 보내야 한다", async () => {
		// Given - 공개 앱이 아는 TODO_SHARED 알림과 최신 앱이 해석할 댓글 문맥
		const input = {
			recipientId: "cmrecip000000000000000001",
			senderId: "cmsender00000000000000001",
			senderName: "보낸 사람",
			todoId: 42,
			commentId: "cmcomment0000000000000001",
			threadRootId: "cmroot000000000000000001",
			isReply: false,
			commentCount: 1,
		};
		const variantContext = {
			campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.TODO_COMMENT_ACTIVITY,
			recipientId: input.recipientId,
			occurrenceKey: input.commentId,
		};
		const message = createTodoCommentNotificationMessage({
			activityKind: "COMMENT",
			commentCount: input.commentCount,
			senderName: input.senderName,
			locale: "ko",
			variantContext,
		});

		// When - 댓글 알림을 영속화하고 발송한다
		await adapter.notifyCommentsWritten(input);

		// Then - v1.8은 TODO_SHARED 기본 화면으로, 최신 앱은 metadata로 이동할 수 있다
		expect(notificationSender.createAndSend).toHaveBeenCalledWith({
			userId: input.recipientId,
			type: "TODO_SHARED",
			title: message.title,
			body: message.body,
			todoId: input.todoId,
			action: { type: "DEEP_LINK" },
			metadata: {
				senderId: input.senderId,
				commentId: input.commentId,
				threadRootId: input.threadRootId,
				activityKind: "COMMENT",
			},
			campaignKey: variantContext.campaignKey,
			variantId: message.variantId,
		});
	});

	it("좋아요 알림도 기기별로 해석할 수 있는 같은 계약을 사용해야 한다", async () => {
		// Given - 댓글 좋아요 알림 문맥
		const input = {
			recipientId: "cmrecip000000000000000001",
			senderId: "cmsender00000000000000001",
			senderName: null,
			todoId: 7,
			commentId: "cmcomment0000000000000001",
			threadRootId: "cmroot000000000000000001",
		};

		// When - 좋아요 알림을 발송한다
		await adapter.notifyCommentLiked(input);

		// Then - 공유 알림 레코드에 특정 모바일 route를 고정하지 않는다
		expect(notificationSender.createAndSend).toHaveBeenCalledWith(
			expect.objectContaining({
				action: { type: "DEEP_LINK" },
				metadata: {
					senderId: input.senderId,
					commentId: input.commentId,
					threadRootId: input.threadRootId,
					activityKind: "LIKE",
				},
			}),
		);
	});

	it("답글은 REPLY activity로 구분한다", async () => {
		// Given
		const input = {
			recipientId: "cmrecip000000000000000001",
			senderId: "cmsender00000000000000001",
			senderName: "보낸 사람",
			todoId: 42,
			commentId: "cmcomment0000000000000001",
			threadRootId: "cmroot000000000000000001",
			isReply: true,
			commentCount: 2,
		};

		// When
		await adapter.notifyCommentsWritten(input);

		// Then
		expect(notificationSender.createAndSend).toHaveBeenCalledWith(
			expect.objectContaining({
				metadata: expect.objectContaining({ activityKind: "REPLY" }),
			}),
		);
	});

	it("같은 댓글 이벤트를 재시도하면 같은 variant를 사용한다", async () => {
		// Given
		const input = {
			recipientId: "cmrecip000000000000000001",
			senderId: "cmsender00000000000000001",
			senderName: "보낸 사람",
			todoId: 42,
			commentId: "cmcomment0000000000000001",
			threadRootId: "cmroot000000000000000001",
			isReply: false,
			commentCount: 1,
		};

		// When
		await adapter.notifyCommentsWritten(input);
		await adapter.notifyCommentsWritten(input);

		// Then
		const first = notificationSender.createAndSend.mock.calls[0]?.[0];
		const retried = notificationSender.createAndSend.mock.calls[1]?.[0];
		expect(first?.variantId).toBeDefined();
		expect(retried?.variantId).toBe(first?.variantId);
		expect(retried?.title).toBe(first?.title);
		expect(retried?.body).toBe(first?.body);
	});

	it("자기 활동은 알림으로 보내지 않는다", async () => {
		// Given
		const userId = "cmuser0000000000000000001";

		// When
		await adapter.notifyCommentLiked({
			recipientId: userId,
			senderId: userId,
			senderName: "작성자",
			todoId: 42,
			commentId: "cmcomment0000000000000001",
			threadRootId: "cmroot000000000000000001",
		});

		// Then
		expect(notificationSender.getUserLocale).not.toHaveBeenCalled();
		expect(notificationSender.createAndSend).not.toHaveBeenCalled();
	});
});
