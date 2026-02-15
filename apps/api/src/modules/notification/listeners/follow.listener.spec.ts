/**
 * FollowListener 단위 테스트 (Suites + GWT 패턴)
 *
 * 팔로우/맞팔로우 이벤트 수신 후 알림 생성 + dedup 검증
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { NotificationService } from "../notification.service";
import { FollowListener } from "./follow.listener";

describe("FollowListener", () => {
	let listener: FollowListener;
	let notificationService: Mocked<NotificationService>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(FollowListener).compile();

		listener = unit;
		notificationService = unitRef.get(
			NotificationService,
		) as unknown as Mocked<NotificationService>;
	});

	// ============================================
	// handleFollowNew
	// ============================================

	describe("handleFollowNew", () => {
		const payload = {
			followerId: "follower-1",
			followingId: "following-1",
			followerName: "홍길동",
		};

		it("FOLLOW_NEW 알림을 createAndSendWithDedup으로 생성한다", async () => {
			// Given
			notificationService.createAndSendWithDedup.mockResolvedValue({} as never);

			// When
			await listener.handleFollowNew(payload);

			// Then
			expect(notificationService.createAndSendWithDedup).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "following-1",
					type: "FOLLOW_NEW",
					friendId: "follower-1",
				}),
			);
		});

		it("dedup에 의해 스킵되어도 에러가 발생하지 않는다", async () => {
			// Given
			notificationService.createAndSendWithDedup.mockResolvedValue(null);

			// When / Then
			await expect(listener.handleFollowNew(payload)).resolves.not.toThrow();
		});

		it("알림 생성 실패 시 에러를 잡아 로깅한다", async () => {
			// Given
			notificationService.createAndSendWithDedup.mockRejectedValue(
				new Error("DB error"),
			);

			// When / Then
			await expect(listener.handleFollowNew(payload)).resolves.not.toThrow();
		});
	});

	// ============================================
	// handleFollowMutual
	// ============================================

	describe("handleFollowMutual", () => {
		const payload = {
			userId: "user-1",
			friendId: "friend-1",
			friendName: "김철수",
		};

		it("FOLLOW_ACCEPTED 알림을 createAndSendWithDedup으로 생성한다", async () => {
			// Given
			notificationService.createAndSendWithDedup.mockResolvedValue({} as never);

			// When
			await listener.handleFollowMutual(payload);

			// Then
			expect(notificationService.createAndSendWithDedup).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-1",
					type: "FOLLOW_ACCEPTED",
					friendId: "friend-1",
				}),
			);
		});

		it("dedup에 의해 스킵되어도 에러가 발생하지 않는다", async () => {
			// Given
			notificationService.createAndSendWithDedup.mockResolvedValue(null);

			// When / Then
			await expect(listener.handleFollowMutual(payload)).resolves.not.toThrow();
		});

		it("알림 생성 실패 시 에러를 잡아 로깅한다", async () => {
			// Given
			notificationService.createAndSendWithDedup.mockRejectedValue(
				new Error("DB error"),
			);

			// When / Then
			await expect(listener.handleFollowMutual(payload)).resolves.not.toThrow();
		});
	});
});
