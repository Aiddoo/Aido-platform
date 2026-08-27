import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { NotificationSender } from "@/notification";

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
			count: 1,
		};

		// When - 댓글 알림을 영속화하고 발송한다
		await adapter.notifyCommentsWritten(input);

		// Then - v1.8은 TODO_SHARED 기본 화면으로, 최신 앱은 metadata로 이동할 수 있다
		expect(notificationSender.createAndSend).toHaveBeenCalledWith({
			userId: input.recipientId,
			type: "TODO_SHARED",
			title: "새 댓글",
			body: "보낸 사람이 할 일에 댓글을 남겼어요.",
			todoId: input.todoId,
			action: { type: "DEEP_LINK" },
			metadata: {
				senderId: input.senderId,
				commentId: input.commentId,
				threadRootId: input.threadRootId,
				activityKind: "COMMENT",
			},
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
			count: 2,
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
