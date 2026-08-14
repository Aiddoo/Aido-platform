import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { flushPromises } from "@test/mocks";
import type { SubscriptionEventPayload } from "@/subscription";
import type { UserRegisteredEventPayload } from "../../domain/types/user-registered.payload";
import { EnqueueSubscriptionEventUseCase } from "../use-cases/enqueue-subscription-event/enqueue-subscription-event.use-case";
import { EnqueueUserRegisteredUseCase } from "../use-cases/enqueue-user-registered/enqueue-user-registered.use-case";
import { AdminEventNotifier } from "./admin-event.notifier";

describe("AdminEventNotifier", () => {
	let adminEventNotifier: AdminEventNotifier;
	let enqueueUserRegistered: Mocked<EnqueueUserRegisteredUseCase>;
	let enqueueSubscriptionEvent: Mocked<EnqueueSubscriptionEventUseCase>;

	const userPayload: UserRegisteredEventPayload = {
		userId: "user-1",
		email: "test@example.com",
		provider: "apple",
		registeredAt: "2026-03-07T12:00:00.000Z",
	};

	const subscriptionPayload: SubscriptionEventPayload = {
		userId: "user-1",
		email: "test@example.com",
		eventType: "INITIAL_PURCHASE",
		productId: "aido_premium_monthly",
	};

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(AdminEventNotifier).compile();
		adminEventNotifier = unit;
		enqueueUserRegistered = unitRef.get(EnqueueUserRegisteredUseCase);
		enqueueSubscriptionEvent = unitRef.get(EnqueueSubscriptionEventUseCase);
		enqueueUserRegistered.execute.mockResolvedValue(undefined);
		enqueueSubscriptionEvent.execute.mockResolvedValue(undefined);
	});

	it("회원가입 이벤트를 비동기로 enqueue한다", async () => {
		adminEventNotifier.notifyUserRegistered(userPayload);
		await flushPromises();
		expect(enqueueUserRegistered.execute).toHaveBeenCalledWith(userPayload);
	});

	it("회원가입 enqueue 실패를 호출자에게 전파하지 않는다", async () => {
		enqueueUserRegistered.execute.mockRejectedValue(new Error("Redis down"));
		adminEventNotifier.notifyUserRegistered(userPayload);
		await expect(flushPromises()).resolves.not.toThrow();
	});

	it("구독 이벤트를 비동기로 enqueue한다", async () => {
		adminEventNotifier.notifySubscriptionEvent(subscriptionPayload);
		await flushPromises();
		expect(enqueueSubscriptionEvent.execute).toHaveBeenCalledWith(
			subscriptionPayload,
		);
	});

	it("구독 enqueue 실패를 호출자에게 전파하지 않는다", async () => {
		enqueueSubscriptionEvent.execute.mockRejectedValue(new Error("Redis down"));
		adminEventNotifier.notifySubscriptionEvent(subscriptionPayload);
		await expect(flushPromises()).resolves.not.toThrow();
	});
});
