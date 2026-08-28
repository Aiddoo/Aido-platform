import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CreateNotificationData } from "../../application/ports/notification-data";
import type { PushDeliveryItem } from "../../application/types/push-delivery.types";
import { DeliverPushNotificationsUseCase } from "../../application/use-cases/deliver-push-notifications/deliver-push-notifications.use-case";
import { InProcessPushDispatcherAdapter } from "./in-process-push-dispatcher.adapter";

function createDeferred<T>(): {
	readonly promise: Promise<T>;
	readonly resolve: (value: T | PromiseLike<T>) => void;
} {
	let resolve: (value: T | PromiseLike<T>) => void = () => undefined;
	const promise = new Promise<T>((resolver) => {
		resolve = resolver;
	});
	return { promise, resolve };
}

function createNotificationData(userId: string, title = "제목"): CreateNotificationData {
	return {
		userId,
		type: "FOLLOW_NEW",
		title,
		body: `${title} 본문`,
	};
}

describe("InProcessPushDispatcherAdapter - fire-and-forget 호환 경계", () => {
	let adapter: InProcessPushDispatcherAdapter;
	let deliverPushNotifications: Mocked<DeliverPushNotificationsUseCase>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(InProcessPushDispatcherAdapter).compile();
		adapter = unit;
		deliverPushNotifications = unitRef.get(DeliverPushNotificationsUseCase);
		deliverPushNotifications.execute.mockResolvedValue(undefined);
	});

	it("단건 호출을 타입이 명확한 single 전달 요청으로 위임한다", async () => {
		// Given - 기존 동기 호출부의 단건 알림
		const data = createNotificationData("user-single");

		// When - fire-and-forget 요청 후 테스트 경계에서 drain
		adapter.fireAndForgetPush(data, 101);
		await adapter.drainPendingPushes();

		// Then - 전달 정책을 실행하지 않고 use case 입력으로만 변환
		expect(deliverPushNotifications.execute).toHaveBeenCalledTimes(1);
		expect(deliverPushNotifications.execute).toHaveBeenCalledWith({
			mode: "single",
			item: { data, notificationId: 101 },
		});
	});

	it("배치 호출을 항목 순서와 참조를 보존한 batch 전달 요청으로 위임한다", async () => {
		// Given - 이미 영속화된 배치 알림 항목
		const items: readonly PushDeliveryItem[] = [
			{ data: createNotificationData("user-first", "첫 번째"), notificationId: 201 },
			{ data: createNotificationData("user-second", "두 번째"), notificationId: 202 },
		];

		// When - fire-and-forget 배치 요청 후 drain
		adapter.fireAndForgetBatchPush(items);
		await adapter.drainPendingPushes();

		// Then - 항목을 재해석하지 않고 use case에 그대로 전달
		expect(deliverPushNotifications.execute).toHaveBeenCalledTimes(1);
		expect(deliverPushNotifications.execute).toHaveBeenCalledWith({ mode: "batch", items });
	});

	it("전달 실패를 호출부로 전파하지 않고 정착된 task로 회수한다", async () => {
		// Given - 실제 전달 use case 실패
		deliverPushNotifications.execute.mockRejectedValue(new Error("provider unavailable"));

		// When - 기존 동기 호출부에서 단건 요청
		expect(() =>
			adapter.fireAndForgetPush(createNotificationData("user-failed"), 301),
		).not.toThrow();

		// Then - 오류는 어댑터 경계에서 흡수되어 drain을 실패시키지 않음
		await expect(adapter.drainPendingPushes()).resolves.toBeUndefined();
	});

	it("drain 도중 새로 추가된 전달 task까지 모두 정착할 때까지 기다린다", async () => {
		// Given - 첫 task가 끝나는 순간 두 번째 task가 시작되는 연쇄 호출
		const releaseFirstDelivery = createDeferred<void>();
		const releaseSecondDelivery = createDeferred<void>();
		const secondDeliveryStarted = createDeferred<void>();
		deliverPushNotifications.execute
			.mockImplementationOnce(async () => {
				await releaseFirstDelivery.promise;
				adapter.fireAndForgetPush(createNotificationData("user-second"), 402);
			})
			.mockImplementationOnce(async () => {
				secondDeliveryStarted.resolve(undefined);
				await releaseSecondDelivery.promise;
			});

		adapter.fireAndForgetPush(createNotificationData("user-first"), 401);
		const draining = adapter.drainPendingPushes();
		releaseFirstDelivery.resolve(undefined);
		await secondDeliveryStarted.promise;

		// When - 두 번째 task가 아직 정착하지 않은 상태에서 drain 완료 여부 확인
		const completedDrain = draining.then<"completed">(() => "completed");
		const drainState = await Promise.race([
			completedDrain,
			new Promise<"pending">((resolve) => {
				setImmediate(() => resolve("pending"));
			}),
		]);

		// Then - 새 task도 추적하고 완료된 뒤에만 drain 종료
		expect(drainState).toBe("pending");
		releaseSecondDelivery.resolve(undefined);
		await expect(draining).resolves.toBeUndefined();
		expect(deliverPushNotifications.execute).toHaveBeenCalledTimes(2);
	});

	it("정착하지 않는 전달은 지정한 시간 상한에서 drain을 실패시킨다", async () => {
		// Given - 영원히 정착하지 않는 전달 task
		deliverPushNotifications.execute.mockImplementation(() => new Promise(() => undefined));
		adapter.fireAndForgetPush(createNotificationData("user-stuck"), 501);

		// When & Then - shutdown 전체를 무한 대기시키지 않고 명시한 deadline 적용
		await expect(adapter.drainPendingPushes(20)).rejects.toThrow(/exceeded 20ms/);
	});

	it("애플리케이션 종료 훅은 drain 실패를 흡수한다", async () => {
		// Given - round 또는 timeout 상한에 걸린 drain
		jest
			.spyOn(adapter, "drainPendingPushes")
			.mockRejectedValue(new Error("Push drain exceeded 25 rounds"));

		// When & Then - 종료 훅 자체는 rejection을 외부로 노출하지 않음
		await expect(adapter.beforeApplicationShutdown()).resolves.toBeUndefined();
	});
});
