import { Inject, Injectable, Logger } from "@nestjs/common";

import type { PushTokenRecord } from "../../domain/records/notification.record";
import {
	FEATURE_DISCOVERY_CAMPAIGN_KEY,
	supportsFeatureDiscoveryMarketing,
} from "../../domain/services/feature-marketing-capability";
import {
	ACTIVE_PUSH_TOKEN_READER,
	type ActivePushTokenReaderPort,
} from "../ports/active-push-token.reader.port";
import { NOTIFICATION_CACHE, type NotificationCachePort } from "../ports/notification-cache.port";
import type { CreateNotificationData } from "../ports/notification-data";
import type { PushDispatchSkipReason } from "../ports/push-dispatch.repository.port";
import {
	PUSH_PROVIDER,
	type PushPayload,
	type PushProvider,
	type PushResult,
} from "../ports/push-provider.port";
import {
	PUSH_TOKEN_REPOSITORY,
	type PushTokenRepositoryPort,
} from "../ports/push-token.repository.port";
import type { BatchPushNotificationPayload } from "./push-notification-payload.factory";

export type SinglePushNotificationDeliveryResult =
	| {
			readonly status: "sent";
			readonly results: PushResult[];
	  }
	| {
			readonly status: "skipped";
			readonly reason: PushDispatchSkipReason;
	  };

interface PreparedBatchPushDeliveryBase {
	readonly attemptedDispatchIds: ReadonlySet<number>;
	readonly skippedDispatches: readonly {
		readonly dispatchId: number;
		readonly reason: PushDispatchSkipReason;
	}[];
	readonly recipientUserIds: readonly string[];
}

export type PreparedBatchPushDelivery =
	| (PreparedBatchPushDeliveryBase & { readonly status: "empty" })
	| (PreparedBatchPushDeliveryBase & {
			readonly status: "ready";
			readonly providerPayloads: readonly PushPayload[];
			readonly dispatchIds: readonly number[];
	  });

export interface BatchPushNotificationDeliveryResult {
	readonly attemptedDispatchIds: ReadonlySet<number>;
	readonly resultsByDispatch: ReadonlyMap<number, PushResult[]>;
}

/** 활성·capability 토큰을 선택하고 provider 전달과 무효 토큰 정리를 수행한다. */
@Injectable()
export class PushNotificationDeliveryService {
	readonly #logger = new Logger(PushNotificationDeliveryService.name);

	constructor(
		@Inject(PUSH_TOKEN_REPOSITORY)
		private readonly pushTokenRepository: PushTokenRepositoryPort,
		@Inject(PUSH_PROVIDER) private readonly pushProvider: PushProvider,
		@Inject(ACTIVE_PUSH_TOKEN_READER)
		private readonly activePushTokenReader: ActivePushTokenReaderPort,
		@Inject(NOTIFICATION_CACHE)
		private readonly notificationCache: NotificationCachePort,
	) {}

	async deliverSingle(input: {
		readonly data: CreateNotificationData;
		readonly payload: Omit<PushPayload, "token">;
	}): Promise<SinglePushNotificationDeliveryResult> {
		const tokenResolution = await this.#resolveSingleTokens(input.data);
		if (tokenResolution.status === "skipped") return tokenResolution;

		const result = await this.pushProvider.sendBatch(
			tokenResolution.tokens.map((token) => ({ ...input.payload, token })),
		);
		if (result.invalidTokens.length > 0) {
			await this.pushTokenRepository.deactivateInvalidTokens(result.invalidTokens);
			await this.notificationCache.invalidatePushTokens(input.data.userId);
			this.#logger.warn(`Deactivated invalid tokens: ${result.invalidTokens.length}`);
		}
		this.#logger.debug(
			`Push sent to user ${input.data.userId}: success=${result.successCount}, failure=${result.failureCount}`,
		);
		return { status: "sent", results: result.results };
	}

	async prepareBatchDelivery(
		payloads: readonly BatchPushNotificationPayload[],
	): Promise<PreparedBatchPushDelivery> {
		const userIds = [...new Set(payloads.map((payload) => payload.userId))];
		const tokensByUser = await this.activePushTokenReader.findByUserIds(userIds);
		const featureUserIds = [
			...new Set(
				payloads
					.filter((payload) => payload.requiresFeatureCapability)
					.map((payload) => payload.userId),
			),
		];
		const featureTokenRecords =
			featureUserIds.length === 0
				? []
				: await this.pushTokenRepository.findActivePushTokensByUsers(featureUserIds);
		const featureTokensByUser = this.#groupTokenRecords(featureTokenRecords);

		const providerPayloads: PushPayload[] = [];
		const dispatchIds: number[] = [];
		const attemptedDispatchIds = new Set<number>();
		const skippedDispatches: Array<{
			dispatchId: number;
			reason: PushDispatchSkipReason;
		}> = [];

		for (const payload of payloads) {
			const activeTokens = tokensByUser.get(payload.userId) ?? [];
			const featureRecords = featureTokensByUser.get(payload.userId) ?? [];
			const activeTokenCount = payload.requiresFeatureCapability
				? featureRecords.length
				: activeTokens.length;
			if (activeTokenCount === 0) {
				skippedDispatches.push({
					dispatchId: payload.dispatchId,
					reason: "NO_ACTIVE_TOKEN",
				});
				continue;
			}

			const tokens = payload.requiresFeatureCapability
				? featureRecords.filter(supportsFeatureDiscoveryMarketing).map((record) => record.token)
				: activeTokens;
			if (tokens.length === 0) {
				skippedDispatches.push({
					dispatchId: payload.dispatchId,
					reason: "UNSUPPORTED_APP_CAPABILITY",
				});
				continue;
			}

			attemptedDispatchIds.add(payload.dispatchId);
			for (const token of tokens) {
				providerPayloads.push({
					token,
					title: payload.title,
					body: payload.body,
					data: payload.data,
				});
				dispatchIds.push(payload.dispatchId);
			}
		}

		if (providerPayloads.length === 0) {
			return {
				status: "empty",
				attemptedDispatchIds,
				skippedDispatches,
				recipientUserIds: userIds,
			};
		}
		return {
			status: "ready",
			providerPayloads,
			dispatchIds,
			attemptedDispatchIds,
			skippedDispatches,
			recipientUserIds: userIds,
		};
	}

	async sendPreparedBatch(
		prepared: Extract<PreparedBatchPushDelivery, { readonly status: "ready" }>,
	): Promise<BatchPushNotificationDeliveryResult> {
		const result = await this.pushProvider.sendBatch([...prepared.providerPayloads]);
		if (result.invalidTokens.length > 0) {
			await this.pushTokenRepository.deactivateInvalidTokens(result.invalidTokens);
			await Promise.all(
				prepared.recipientUserIds.map((userId) =>
					this.notificationCache.invalidatePushTokens(userId),
				),
			);
			this.#logger.warn(`Deactivated invalid tokens: ${result.invalidTokens.length}`);
		}
		this.#logger.debug(
			`Batch push sent: total=${result.total}, success=${result.successCount}, failure=${result.failureCount}`,
		);

		const resultsByDispatch = new Map<number, PushResult[]>();
		for (const [index, pushResult] of result.results.entries()) {
			const dispatchId = prepared.dispatchIds[index];
			if (dispatchId === undefined) continue;
			const current = resultsByDispatch.get(dispatchId) ?? [];
			current.push(pushResult);
			resultsByDispatch.set(dispatchId, current);
		}
		return { attemptedDispatchIds: prepared.attemptedDispatchIds, resultsByDispatch };
	}

	async #resolveSingleTokens(
		data: CreateNotificationData,
	): Promise<
		| { readonly status: "resolved"; readonly tokens: readonly string[] }
		| { readonly status: "skipped"; readonly reason: PushDispatchSkipReason }
	> {
		if (data.campaignKey === FEATURE_DISCOVERY_CAMPAIGN_KEY) {
			const records = await this.pushTokenRepository.findPushTokensByUser({
				userId: data.userId,
				activeOnly: true,
			});
			if (records.length === 0) return { status: "skipped", reason: "NO_ACTIVE_TOKEN" };

			const tokens = records
				.filter(supportsFeatureDiscoveryMarketing)
				.map((record) => record.token);
			return tokens.length > 0
				? { status: "resolved", tokens }
				: { status: "skipped", reason: "UNSUPPORTED_APP_CAPABILITY" };
		}

		const tokens = await this.activePushTokenReader.findByUserId(data.userId);
		return tokens.length > 0
			? { status: "resolved", tokens }
			: { status: "skipped", reason: "NO_ACTIVE_TOKEN" };
	}

	#groupTokenRecords(records: PushTokenRecord[]): Map<string, PushTokenRecord[]> {
		const byUserId = new Map<string, PushTokenRecord[]>();
		for (const record of records) {
			const userRecords = byUserId.get(record.userId) ?? [];
			userRecords.push(record);
			byUserId.set(record.userId, userRecords);
		}
		return byUserId;
	}
}
