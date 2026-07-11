/**
 * AdminNotificationFacade 단위 테스트
 *
 * - 유스케이스 위임
 * - fire-and-forget: 유스케이스 실패 시 예외를 전파하지 않는다
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { flushPromises } from "@test/mocks";

import type { SubscriptionEventPayload } from "@/subscription";

import type { UserRegisteredEventPayload } from "../../domain/events/user-registered.payload";
import { EnqueueSubscriptionEventUseCase } from "../use-cases/enqueue-subscription-event/enqueue-subscription-event.use-case";
import { EnqueueUserRegisteredUseCase } from "../use-cases/enqueue-user-registered/enqueue-user-registered.use-case";
import { AdminNotificationFacade } from "./admin-notification.facade";

describe("AdminNotificationFacade", () => {
	let facade: AdminNotificationFacade;
	let enqueueUserRegistered: Mocked<EnqueueUserRegisteredUseCase>;
	let enqueueSubscriptionEvent: Mocked<EnqueueSubscriptionEventUseCase>;

	const userPayload: UserRegisteredEventPayload = {
		userId: "user-1",
		email: "test@example.com",
		provider: "apple",
		registeredAt: "2026-03-07T12:00:00.000Z",
	};

	const subPayload: SubscriptionEventPayload = {
		userId: "user-1",
		email: "test@example.com",
		eventType: "INITIAL_PURCHASE",
		productId: "aido_premium_monthly",
	};

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			AdminNotificationFacade,
		).compile();
		facade = unit;
		enqueueUserRegistered = unitRef.get(EnqueueUserRegisteredUseCase);
		enqueueSubscriptionEvent = unitRef.get(EnqueueSubscriptionEventUseCase);
		enqueueUserRegistered.execute.mockResolvedValue(undefined);
		enqueueSubscriptionEvent.execute.mockResolvedValue(undefined);
	});

	describe("notifyUserRegistered", () => {
		it("회원가입 유스케이스에 위임한다", async () => {
			facade.notifyUserRegistered(userPayload);
			await flushPromises();

			expect(enqueueUserRegistered.execute).toHaveBeenCalledWith(userPayload);
		});

		it("유스케이스 실패 시 에러를 throw하지 않는다 (fire-and-forget)", async () => {
			enqueueUserRegistered.execute.mockRejectedValue(new Error("Redis down"));

			facade.notifyUserRegistered(userPayload);
			await expect(flushPromises()).resolves.not.toThrow();
		});
	});

	describe("notifySubscriptionEvent", () => {
		it("구독 이벤트 유스케이스에 위임한다", async () => {
			facade.notifySubscriptionEvent(subPayload);
			await flushPromises();

			expect(enqueueSubscriptionEvent.execute).toHaveBeenCalledWith(subPayload);
		});

		it("유스케이스 실패 시 에러를 throw하지 않는다 (fire-and-forget)", async () => {
			enqueueSubscriptionEvent.execute.mockRejectedValue(
				new Error("Redis down"),
			);

			facade.notifySubscriptionEvent(subPayload);
			await expect(flushPromises()).resolves.not.toThrow();
		});
	});
});
