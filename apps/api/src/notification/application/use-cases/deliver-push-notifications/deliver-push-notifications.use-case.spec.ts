/**
 * Durable push worker orchestration contract.
 *
 * Provider accept와 DB finalize 사이에는 외부 트랜잭션 경계가 있으므로 전달 보장은
 * exactly-once가 아니라 durable at-least-once다. 아래 테스트는 재시도 때 stale worker가
 * 상태를 덮어쓰지 않도록 모든 상태 변경이 claimed fence와 UOW를 거치는지 고정한다.
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";

import { InMemoryPushRateLimiter } from "../../../infrastructure/rate-limiter/in-memory-push-rate-limiter";
import { PushDeliveryRateLimitReservationConflictError } from "../../errors/push-delivery-rate-limit-reservation-conflict.error";
import type { CreateNotificationData } from "../../ports/notification-data";
import {
	PUSH_DELIVERY_LIFECYCLE_REPOSITORY,
	type ReservePushDeliveryRateLimitInput,
	type ClaimedPushDelivery,
	type PushDeliveryLifecycleRepositoryPort,
} from "../../ports/push-delivery-lifecycle.repository.port";
import {
	type PushResult,
	RetryablePushProviderTransportError,
} from "../../ports/push-provider.port";
import {
	type BatchPushDeliveryRecipient,
	PushDeliveryEligibilityService,
	type SinglePushDeliveryRecipient,
} from "../../services/push-delivery-eligibility.service";
import { PushNotificationDeliveryService } from "../../services/push-notification-delivery.service";
import { PushNotificationPayloadFactory } from "../../services/push-notification-payload.factory";
import type { DeliverPushNotificationsInput } from "../../types/push-delivery.types";
import { DeliverPushNotificationsUseCase } from "./deliver-push-notifications.use-case";

const PROCESSING_JOB_ID = "push-delivery-job-20260829";
const LOCAL_DATE = "2026-08-29";

function createNotificationData(
	userId: string,
	overrides: Partial<CreateNotificationData> = {},
): CreateNotificationData {
	return {
		userId,
		type: "FOLLOW_NEW",
		title: `${userId} title`,
		body: `${userId} body`,
		...overrides,
	};
}

function createClaimedDelivery(input: {
	readonly dispatchId: number;
	readonly deliveryMode: ClaimedPushDelivery["deliveryMode"];
	readonly userId: string;
	readonly notificationId?: number;
	readonly force?: boolean;
	readonly publishAttempt?: number;
	readonly rateLimitReservation?: ClaimedPushDelivery["rateLimitReservation"];
	readonly dataOverrides?: Partial<CreateNotificationData>;
}): ClaimedPushDelivery {
	const force = input.force ?? false;
	return {
		fence: {
			dispatchId: input.dispatchId,
			publishAttempt: input.publishAttempt ?? 2,
			processingJobId: PROCESSING_JOB_ID,
			deliveryAttemptCount: 3,
		},
		deliveryMode: input.deliveryMode,
		force,
		rateLimitReservation: input.rateLimitReservation ?? { status: "pending" },
		item: {
			notificationId: input.notificationId ?? input.dispatchId + 1_000,
			data: createNotificationData(input.userId, { force, ...input.dataOverrides }),
		},
	};
}

function createExecutionInput(
	claimed: readonly ClaimedPushDelivery[],
): DeliverPushNotificationsInput {
	return {
		processingJobId: PROCESSING_JOB_ID,
		processingJobAttempt: 1,
		publications: claimed.map(({ fence }) => ({
			dispatchId: fence.dispatchId,
			publishAttempt: fence.publishAttempt,
		})),
		isFinalAttempt: false,
	};
}

function createSingleRecipient(userId: string): SinglePushDeliveryRecipient {
	return {
		userId,
		timezone: "Asia/Seoul",
		localDate: LOCAL_DATE,
		preference: {
			pushEnabled: true,
			nightPushEnabled: true,
			timezone: "Asia/Seoul",
			locale: "ko",
			morningReminderHour: 8,
			morningReminderMinute: 0,
			eveningReminderHour: 19,
			eveningReminderMinute: 0,
			timeFormat: "TWENTY_FOUR_HOUR",
			weatherMorningEnabled: true,
			weatherMorningHour: 7,
			weatherMorningMinute: 0,
			weatherEveningEnabled: true,
			weatherEveningHour: 17,
			weatherEveningMinute: 30,
		},
	};
}

function createBatchRecipient(userId: string): BatchPushDeliveryRecipient {
	const single = createSingleRecipient(userId);
	return {
		...single,
		consent: { marketingPushAgreedAt: new Date("2026-08-01T00:00:00.000Z") },
	};
}

interface PersistenceObservation {
	readonly operation:
		| "claim"
		| "markRateLimitReserved"
		| "finalizeResults"
		| "finalizeSkipped"
		| "release";
	readonly transactionDepth: number;
}

describe("DeliverPushNotificationsUseCase — durable staged delivery", () => {
	let useCase: DeliverPushNotificationsUseCase;
	let lifecycle: Mocked<PushDeliveryLifecycleRepositoryPort>;
	let uow: Mocked<UnitOfWorkPort>;
	let eligibility: Mocked<PushDeliveryEligibilityService>;
	let payloadFactory: Mocked<PushNotificationPayloadFactory>;
	let delivery: Mocked<PushNotificationDeliveryService>;
	let claimedDeliveries: readonly ClaimedPushDelivery[];
	let finalizeResultsError: Error | null;
	let transactionDepth: number;
	let persistenceObservations: PersistenceObservation[];
	let callOrder: string[];

	beforeEach(async () => {
		claimedDeliveries = [];
		finalizeResultsError = null;
		transactionDepth = 0;
		persistenceObservations = [];
		callOrder = [];

		const observePersistence = (operation: PersistenceObservation["operation"]): void => {
			callOrder.push(operation);
			persistenceObservations.push({ operation, transactionDepth });
		};
		const run = jest.fn();
		run.mockImplementation(async (work: () => Promise<unknown>) => {
			transactionDepth += 1;
			try {
				return await work();
			} finally {
				transactionDepth -= 1;
			}
		});

		const { unit, unitRef } = await TestBed.solitary(DeliverPushNotificationsUseCase)
			.mock<PushDeliveryLifecycleRepositoryPort>(PUSH_DELIVERY_LIFECYCLE_REPOSITORY)
			.impl(() => ({
				claim: jest.fn(async () => {
					observePersistence("claim");
					return claimedDeliveries;
				}),
				markRateLimitReserved: jest.fn(
					async (inputs: readonly ReservePushDeliveryRateLimitInput[]) => {
						observePersistence("markRateLimitReserved");
						return inputs.map((input) => input.fence.dispatchId);
					},
				),
				reopenAfterFinalClaimFailure: jest.fn(async () => 0),
				reopenFailedPublications: jest.fn(async () => 0),
				finalizeSkipped: jest.fn(async (inputs) => {
					observePersistence("finalizeSkipped");
					return inputs.length;
				}),
				finalizeResults: jest.fn(async (inputs) => {
					observePersistence("finalizeResults");
					if (finalizeResultsError) throw finalizeResultsError;
					return inputs.length;
				}),
				release: jest.fn(async (inputs) => {
					observePersistence("release");
					return inputs.length;
				}),
				recoverStaleProcessing: jest.fn(async () => 0),
			}))
			.mock<UnitOfWorkPort>(UNIT_OF_WORK)
			.impl(() => ({ run }))
			.compile();

		useCase = unit;
		lifecycle = unitRef.get(PUSH_DELIVERY_LIFECYCLE_REPOSITORY);
		uow = unitRef.get(UNIT_OF_WORK);
		eligibility = unitRef.get(PushDeliveryEligibilityService);
		payloadFactory = unitRef.get(PushNotificationPayloadFactory);
		delivery = unitRef.get(PushNotificationDeliveryService);

		eligibility.loadSingleRecipient.mockImplementation(async (userId) => {
			callOrder.push("loadSingleRecipient");
			return createSingleRecipient(userId);
		});
		eligibility.evaluateSingle.mockImplementation(async (data) => {
			callOrder.push("evaluateSingle");
			return { status: "eligible", candidate: data };
		});
		eligibility.loadBatchRecipients.mockImplementation(async (userIds) => {
			callOrder.push("loadBatchRecipients");
			return new Map(userIds.map((userId) => [userId, createBatchRecipient(userId)]));
		});
		eligibility.evaluateBatchSettings.mockImplementation((candidates) => {
			callOrder.push("evaluateBatchSettings");
			return candidates.map((candidate) => ({ status: "eligible", candidate }));
		});
		eligibility.reserveBatch.mockImplementation(async (candidates) => {
			callOrder.push("reserveBatch");
			return candidates.map((candidate) => ({ status: "eligible", candidate }));
		});
		payloadFactory.createSingle.mockImplementation(({ data, notificationId, dispatchId }) => {
			callOrder.push("createSinglePayload");
			return {
				title: data.title,
				body: data.body,
				data: { notificationId, dispatchId },
			};
		});
		payloadFactory.createBatch.mockImplementation(({ data, notificationId, dispatchId }) => {
			callOrder.push(`createBatchPayload:${dispatchId}`);
			return {
				userId: data.userId,
				dispatchId,
				requiresFeatureCapability: false,
				title: data.title,
				body: data.body,
				data: { notificationId, dispatchId },
			};
		});
		delivery.deliverSingle.mockImplementation(async ({ data }) => {
			callOrder.push("deliverSingle");
			return {
				status: "sent",
				results: [{ token: `token-${data.userId}`, success: true }],
			};
		});
		delivery.prepareBatchDelivery.mockImplementation(async (payloads) => {
			callOrder.push("prepareBatchDelivery");
			return {
				status: "ready",
				providerPayloads: payloads.map((payload) => ({
					token: `token-${payload.userId}`,
					title: payload.title,
					body: payload.body,
					data: payload.data,
				})),
				dispatchIds: payloads.map(({ dispatchId }) => dispatchId),
				attemptedDispatchIds: new Set(payloads.map(({ dispatchId }) => dispatchId)),
				skippedDispatches: [],
				recipientUserIds: payloads.map(({ userId }) => userId),
			};
		});
		delivery.sendPreparedBatch.mockImplementation(async (prepared) => {
			callOrder.push("sendPreparedBatch");
			return {
				attemptedDispatchIds: prepared.attemptedDispatchIds,
				resultsByDispatch: new Map(
					[...prepared.attemptedDispatchIds].map((dispatchId) => [
						dispatchId,
						[{ token: `token-${dispatchId}`, success: true } satisfies PushResult],
					]),
				),
			};
		});
	});

	function expectPersistenceInsideUnitOfWork(): void {
		expect(persistenceObservations.length).toBeGreaterThan(0);
		for (const observation of persistenceObservations) {
			expect(observation.transactionDepth).toBe(1);
		}
	}

	it("claim 결과가 없으면 delivery나 불필요한 finalize를 수행하지 않는다", async () => {
		const input: DeliverPushNotificationsInput = {
			processingJobId: PROCESSING_JOB_ID,
			processingJobAttempt: 1,
			publications: [{ dispatchId: 1, publishAttempt: 1 }],
			isFinalAttempt: false,
		};

		await useCase.execute(input);

		expect(lifecycle.claim).toHaveBeenCalledWith({
			processingJobId: input.processingJobId,
			processingJobAttempt: input.processingJobAttempt,
			publications: input.publications,
			startedAt: expect.any(Date),
		});
		expect(uow.run).toHaveBeenCalledTimes(1);
		expect(eligibility.loadSingleRecipient).not.toHaveBeenCalled();
		expect(eligibility.loadBatchRecipients).not.toHaveBeenCalled();
		expect(delivery.deliverSingle).not.toHaveBeenCalled();
		expect(delivery.prepareBatchDelivery).not.toHaveBeenCalled();
		expect(lifecycle.finalizeSkipped).not.toHaveBeenCalled();
		expect(lifecycle.finalizeResults).not.toHaveBeenCalled();
		expect(lifecycle.release).not.toHaveBeenCalled();
		expectPersistenceInsideUnitOfWork();
	});

	it("SINGLE은 claim → recipient → eligibility → payload → delivery → fenced finalize 순서다", async () => {
		const claimed = createClaimedDelivery({
			dispatchId: 11,
			deliveryMode: "SINGLE",
			userId: "single-user",
			notificationId: 111,
		});
		claimedDeliveries = [claimed];

		await useCase.execute(createExecutionInput(claimedDeliveries));

		expect(callOrder).toEqual([
			"claim",
			"loadSingleRecipient",
			"evaluateSingle",
			"markRateLimitReserved",
			"createSinglePayload",
			"deliverSingle",
			"finalizeResults",
		]);
		expect(payloadFactory.createSingle).toHaveBeenCalledWith({
			data: claimed.item.data,
			notificationId: 111,
			dispatchId: 11,
		});
		expect(lifecycle.finalizeResults).toHaveBeenCalledWith([
			{
				fence: claimed.fence,
				context: {
					timezone: "Asia/Seoul",
					localDate: new Date("2026-08-29T00:00:00.000Z"),
				},
				results: [{ token: "token-single-user", success: true }],
			},
		]);
		expect(uow.run).toHaveBeenCalledTimes(3);
		expectPersistenceInsideUnitOfWork();
	});

	it("SINGLE eligibility skip은 payload/provider를 호출하지 않고 같은 fence를 finalize한다", async () => {
		const claimed = createClaimedDelivery({
			dispatchId: 12,
			deliveryMode: "SINGLE",
			userId: "push-disabled-user",
		});
		claimedDeliveries = [claimed];
		eligibility.evaluateSingle.mockImplementation(async (data) => {
			callOrder.push("evaluateSingle");
			return { status: "skipped", candidate: data, reason: "PUSH_DISABLED" };
		});

		await useCase.execute(createExecutionInput(claimedDeliveries));

		expect(callOrder).toEqual([
			"claim",
			"loadSingleRecipient",
			"evaluateSingle",
			"finalizeSkipped",
		]);
		expect(payloadFactory.createSingle).not.toHaveBeenCalled();
		expect(delivery.deliverSingle).not.toHaveBeenCalled();
		expect(lifecycle.finalizeSkipped).toHaveBeenCalledWith([
			{
				fence: claimed.fence,
				context: {
					timezone: "Asia/Seoul",
					localDate: new Date("2026-08-29T00:00:00.000Z"),
				},
				reason: "PUSH_DISABLED",
			},
		]);
		expectPersistenceInsideUnitOfWork();
	});

	it("SINGLE token skip도 provider 결과 대신 skip reason을 fenced finalize한다", async () => {
		const claimed = createClaimedDelivery({
			dispatchId: 13,
			deliveryMode: "SINGLE",
			userId: "no-token-user",
		});
		claimedDeliveries = [claimed];
		delivery.deliverSingle.mockImplementation(async () => {
			callOrder.push("deliverSingle");
			return { status: "skipped", reason: "NO_ACTIVE_TOKEN" };
		});

		await useCase.execute(createExecutionInput(claimedDeliveries));

		expect(lifecycle.finalizeSkipped).toHaveBeenCalledWith([
			expect.objectContaining({ fence: claimed.fence, reason: "NO_ACTIVE_TOKEN" }),
		]);
		expect(lifecycle.finalizeResults).not.toHaveBeenCalled();
		expectPersistenceInsideUnitOfWork();
	});

	it("mixed SINGLE/BATCH는 저장된 mode를 보존하고 배치 정책 단계별 skip과 결과를 분리한다", async () => {
		const settingsSkipped = createClaimedDelivery({
			dispatchId: 201,
			deliveryMode: "BATCH",
			userId: "settings-skipped",
		});
		const single = createClaimedDelivery({
			dispatchId: 101,
			deliveryMode: "SINGLE",
			userId: "single-first",
		});
		const rateLimited = createClaimedDelivery({
			dispatchId: 202,
			deliveryMode: "BATCH",
			userId: "rate-limited",
		});
		const tokenSkipped = createClaimedDelivery({
			dispatchId: 203,
			deliveryMode: "BATCH",
			userId: "token-skipped",
		});
		const sent = createClaimedDelivery({
			dispatchId: 204,
			deliveryMode: "BATCH",
			userId: "batch-sent",
			force: true,
		});
		claimedDeliveries = [settingsSkipped, single, rateLimited, tokenSkipped, sent];
		eligibility.evaluateBatchSettings.mockImplementation((candidates) => {
			callOrder.push("evaluateBatchSettings");
			return candidates.map((candidate) =>
				candidate.data.userId === settingsSkipped.item.data.userId
					? { status: "skipped", candidate, reason: "PUSH_DISABLED" }
					: { status: "eligible", candidate },
			);
		});
		eligibility.reserveBatch.mockImplementation(async (candidates) => {
			callOrder.push("reserveBatch");
			return candidates.map((candidate) =>
				candidate.data.userId === rateLimited.item.data.userId
					? { status: "skipped", candidate, reason: "RATE_LIMITED" }
					: { status: "eligible", candidate },
			);
		});
		delivery.prepareBatchDelivery.mockImplementation(async (_payloads) => {
			callOrder.push("prepareBatchDelivery");
			return {
				status: "ready",
				providerPayloads: [
					{
						token: "token-batch-sent",
						title: sent.item.data.title,
						body: sent.item.data.body,
					},
				],
				dispatchIds: [sent.fence.dispatchId],
				attemptedDispatchIds: new Set([sent.fence.dispatchId]),
				skippedDispatches: [
					{ dispatchId: tokenSkipped.fence.dispatchId, reason: "NO_ACTIVE_TOKEN" },
				],
				recipientUserIds: [tokenSkipped.item.data.userId, sent.item.data.userId],
			};
		});

		await useCase.execute(createExecutionInput(claimedDeliveries));

		expect(eligibility.loadBatchRecipients).toHaveBeenCalledWith([
			"settings-skipped",
			"rate-limited",
			"token-skipped",
			"batch-sent",
		]);
		expect(eligibility.evaluateBatchSettings).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({
					dispatchId: 204,
					data: expect.objectContaining({ userId: "batch-sent", force: true }),
				}),
			]),
			expect.any(Map),
		);
		expect(payloadFactory.createBatch).toHaveBeenCalledTimes(2);
		expect(payloadFactory.createBatch).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ dispatchId: 203 }),
		);
		expect(payloadFactory.createBatch).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ dispatchId: 204 }),
		);
		expect(lifecycle.finalizeSkipped).toHaveBeenNthCalledWith(1, [
			expect.objectContaining({ fence: settingsSkipped.fence, reason: "PUSH_DISABLED" }),
		]);
		expect(lifecycle.finalizeSkipped).toHaveBeenNthCalledWith(2, [
			expect.objectContaining({ fence: rateLimited.fence, reason: "RATE_LIMITED" }),
		]);
		expect(lifecycle.finalizeSkipped).toHaveBeenNthCalledWith(3, [
			expect.objectContaining({ fence: tokenSkipped.fence, reason: "NO_ACTIVE_TOKEN" }),
		]);
		expect(lifecycle.finalizeResults).toHaveBeenNthCalledWith(1, [
			expect.objectContaining({ fence: single.fence }),
		]);
		expect(lifecycle.finalizeResults).toHaveBeenNthCalledWith(2, [
			{
				fence: sent.fence,
				context: {
					timezone: "Asia/Seoul",
					localDate: new Date("2026-08-29T00:00:00.000Z"),
				},
				results: [{ token: "token-204", success: true }],
			},
		]);
		expect(callOrder.indexOf("deliverSingle")).toBeLessThan(
			callOrder.indexOf("loadBatchRecipients"),
		);
		expect(delivery.sendPreparedBatch).toHaveBeenCalledTimes(1);
		expectPersistenceInsideUnitOfWork();
	});

	it("rate-limit 예약은 generation이 바뀌어도 재사용하되 revocable 설정은 다시 평가한다", async () => {
		const claimed = createClaimedDelivery({
			dispatchId: 250,
			deliveryMode: "SINGLE",
			userId: "reserved-user",
			publishAttempt: 9,
			rateLimitReservation: { status: "reserved" },
		});
		claimedDeliveries = [claimed];

		await useCase.execute(createExecutionInput(claimedDeliveries));

		expect(eligibility.loadSingleRecipient).toHaveBeenCalledWith("reserved-user");
		expect(eligibility.evaluateSingle).toHaveBeenCalledWith(
			claimed.item.data,
			expect.any(Object),
			250,
			true,
		);
		expect(lifecycle.markRateLimitReserved).not.toHaveBeenCalled();
		expect(delivery.deliverSingle).toHaveBeenCalledTimes(1);
		expect(lifecycle.finalizeResults).toHaveBeenCalledWith([
			expect.objectContaining({ fence: claimed.fence }),
		]);
	});

	it("정책 승인 CAS가 일부라도 fence를 잃으면 provider 전에 release하고 retry한다", async () => {
		const claimed = createClaimedDelivery({
			dispatchId: 260,
			deliveryMode: "SINGLE",
			userId: "stale-policy-worker",
		});
		claimedDeliveries = [claimed];
		lifecycle.markRateLimitReserved.mockResolvedValue([]);

		await expect(useCase.execute(createExecutionInput(claimedDeliveries))).rejects.toBeInstanceOf(
			PushDeliveryRateLimitReservationConflictError,
		);

		expect(delivery.deliverSingle).not.toHaveBeenCalled();
		expect(lifecycle.release).toHaveBeenCalledWith([
			expect.objectContaining({ fence: claimed.fence, reopenOutbox: false }),
		]);
	});

	it("DB 승인 write 실패 뒤 두 번째 execute도 같은 dispatch rate 예약을 재사용한다", async () => {
		const limiter = new InMemoryPushRateLimiter();
		const claimed = createClaimedDelivery({
			dispatchId: 270,
			deliveryMode: "BATCH",
			userId: "engagement-retry",
			dataOverrides: { type: "LUNCH_NUDGE", purpose: "ENGAGEMENT" },
		});
		claimedDeliveries = [claimed];
		eligibility.reserveBatch.mockImplementation(async (candidates) => {
			callOrder.push("reserveBatch");
			const limited = await limiter.reserveBatch(
				candidates.map((candidate) => ({
					dispatchId: candidate.rateLimitDispatchId,
					userId: candidate.data.userId,
					engagementLocalDate: LOCAL_DATE,
				})),
			);
			return candidates.map((candidate, index) =>
				limited[index]
					? { status: "skipped" as const, candidate, reason: "RATE_LIMITED" as const }
					: { status: "eligible" as const, candidate },
			);
		});
		const reservationWriteError = new Error("reservation commit unavailable");
		lifecycle.markRateLimitReserved
			.mockRejectedValueOnce(reservationWriteError)
			.mockResolvedValueOnce([claimed.fence.dispatchId]);

		await expect(useCase.execute(createExecutionInput(claimedDeliveries))).rejects.toBe(
			reservationWriteError,
		);
		await expect(
			useCase.execute({ ...createExecutionInput(claimedDeliveries), processingJobAttempt: 2 }),
		).resolves.toBeUndefined();

		expect(eligibility.reserveBatch).toHaveBeenCalledTimes(2);
		expect(lifecycle.finalizeSkipped).not.toHaveBeenCalledWith(
			expect.arrayContaining([expect.objectContaining({ reason: "RATE_LIMITED" })]),
		);
		expect(delivery.sendPreparedBatch).toHaveBeenCalledTimes(1);
		limiter.destroy();
	});

	it("마지막 runtime attempt의 provider 오류는 lease와 outbox를 reopen하고 다시 던진다", async () => {
		const first = createClaimedDelivery({
			dispatchId: 301,
			deliveryMode: "BATCH",
			userId: "first-batch-user",
		});
		const second = createClaimedDelivery({
			dispatchId: 302,
			deliveryMode: "BATCH",
			userId: "second-batch-user",
		});
		claimedDeliveries = [first, second];
		const providerError = new RetryablePushProviderTransportError(
			{
				providerName: "expo",
				resolvedPayloadCountBeforeFailure: 1,
				acceptedTicketCountBeforeFailure: 1,
				unconfirmedPayloadCount: 1,
				unattemptedPayloadCount: 0,
			},
			{ cause: new Error("expo provider unavailable") },
		);
		delivery.sendPreparedBatch.mockRejectedValue(providerError);

		await expect(
			useCase.execute({ ...createExecutionInput(claimedDeliveries), isFinalAttempt: true }),
		).rejects.toBe(providerError);

		expect(lifecycle.release).toHaveBeenCalledWith(
			claimedDeliveries.map(({ fence }) => ({
				fence,
				error: providerError.message,
				reopenOutbox: true,
				availableAt: expect.any(Date),
			})),
		);
		expect(persistenceObservations.at(-1)).toEqual({
			operation: "release",
			transactionDepth: 1,
		});
		expectPersistenceInsideUnitOfWork();
	});

	it("provider 성공 후 finalize 실패는 lease를 release해 at-least-once 재시도를 허용한다", async () => {
		const claimed = createClaimedDelivery({
			dispatchId: 401,
			deliveryMode: "SINGLE",
			userId: "accepted-before-finalize",
		});
		claimedDeliveries = [claimed];
		finalizeResultsError = new Error("database commit unavailable");

		await expect(useCase.execute(createExecutionInput(claimedDeliveries))).rejects.toThrow(
			finalizeResultsError,
		);

		expect(delivery.deliverSingle).toHaveBeenCalledTimes(1);
		expect(lifecycle.finalizeResults).toHaveBeenCalledWith([
			expect.objectContaining({ fence: claimed.fence }),
		]);
		expect(lifecycle.release).toHaveBeenCalledWith([
			{
				fence: claimed.fence,
				error: finalizeResultsError.message,
				reopenOutbox: false,
				availableAt: expect.any(Date),
			},
		]);
		expect(callOrder).toEqual([
			"claim",
			"loadSingleRecipient",
			"evaluateSingle",
			"markRateLimitReserved",
			"createSinglePayload",
			"deliverSingle",
			"finalizeResults",
			"release",
		]);
		expect(uow.run).toHaveBeenCalledTimes(4);
		expectPersistenceInsideUnitOfWork();
	});

	it("중간 attempt의 initial claim DB 오류는 publication을 reopen하지 않고 원본 오류를 보존한다", async () => {
		const claimError = new Error("claim database unavailable");
		lifecycle.claim.mockRejectedValueOnce(claimError);
		const input = {
			...createExecutionInput([
				createClaimedDelivery({ dispatchId: 401, deliveryMode: "SINGLE", userId: "claim-user" }),
			]),
			isFinalAttempt: false,
		};

		await expect(useCase.execute(input)).rejects.toBe(claimError);
		expect(lifecycle.reopenAfterFinalClaimFailure).not.toHaveBeenCalled();
	});

	it("마지막 attempt의 initial claim 오류는 matching generation을 UOW에서 reopen한다", async () => {
		const claimError = new Error("claim database recovered");
		lifecycle.claim.mockRejectedValueOnce(claimError);
		lifecycle.reopenAfterFinalClaimFailure.mockResolvedValueOnce(1);
		const input = {
			...createExecutionInput([
				createClaimedDelivery({ dispatchId: 402, deliveryMode: "SINGLE", userId: "claim-user" }),
			]),
			isFinalAttempt: true,
		};

		await expect(useCase.execute(input)).rejects.toBe(claimError);
		expect(lifecycle.reopenAfterFinalClaimFailure).toHaveBeenCalledWith({
			publications: input.publications,
			availableAt: expect.any(Date),
			error: claimError.message,
		});
	});

	it("마지막 claim recovery가 partial이거나 DB 실패해도 원본 claim 오류를 바꾸지 않는다", async () => {
		const firstClaimError = new Error("first claim failure");
		lifecycle.claim.mockRejectedValueOnce(firstClaimError);
		lifecycle.reopenAfterFinalClaimFailure.mockResolvedValueOnce(0);
		const input = {
			...createExecutionInput([
				createClaimedDelivery({ dispatchId: 403, deliveryMode: "SINGLE", userId: "claim-user" }),
			]),
			isFinalAttempt: true,
		};
		await expect(useCase.execute(input)).rejects.toBe(firstClaimError);

		const secondClaimError = new Error("second claim failure");
		lifecycle.claim.mockRejectedValueOnce(secondClaimError);
		lifecycle.reopenAfterFinalClaimFailure.mockRejectedValueOnce(
			new Error("recovery database unavailable"),
		);
		await expect(useCase.execute(input)).rejects.toBe(secondClaimError);
	});
});
