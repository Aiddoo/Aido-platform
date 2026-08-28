import { ErrorCode } from "@aido/errors";
import { Injectable, Logger } from "@nestjs/common";
import Expo, { type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";

import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";

import type {
	BatchPushResult,
	PushPayload,
	PushProvider,
	PushReceiptResult,
	PushResult,
} from "../../application/ports/push-provider.port";
import { RetryablePushProviderTransportError } from "../../application/ports/push-provider.port";
import { buildExpoPushMessage, type ExpoPushMessageBuildResult } from "./expo-push-message";

const EXPO_MESSAGE_TOO_BIG_ERROR_CODE = "MessageTooBig";

/**
 * Expo Push Provider
 *
 * Expo Push Notifications를 통한 푸시 알림 발송
 *
 * @see https://docs.expo.dev/push-notifications/overview/
 */
@Injectable()
export class ExpoPushProvider implements PushProvider {
	readonly name = "expo";
	readonly #logger = new Logger(ExpoPushProvider.name);
	readonly #expo: Expo;

	constructor(config: TypedConfigService) {
		const accessToken = config.expoAccessToken;
		this.#expo = new Expo(accessToken ? { accessToken } : undefined);
	}

	/**
	 * Expo 푸시 토큰 유효성 검증
	 *
	 * Expo SDK가 지원하는 bracket token과 UUID 형식을 판별한다.
	 */
	validateToken(token: string): boolean {
		return Expo.isExpoPushToken(token);
	}

	async getReceipts(ticketIds: string[]): Promise<PushReceiptResult[]> {
		const results: PushReceiptResult[] = [];
		for (const chunk of this.#expo.chunkPushNotificationReceiptIds(ticketIds)) {
			const receipts = await this.#expo.getPushNotificationReceiptsAsync(chunk);
			for (const ticketId of chunk) {
				const receipt = receipts[ticketId];
				if (!receipt) continue;
				if (receipt.status === "ok") {
					results.push({ ticketId, delivered: true });
				} else {
					results.push({
						ticketId,
						delivered: false,
						errorCode: receipt.details?.error,
						error: receipt.message,
					});
				}
			}
		}
		return results;
	}

	/**
	 * 단일 푸시 알림 발송
	 *
	 * @throws {ApplicationException} NOTIFICATION_1001 - 유효하지 않은 토큰
	 * @throws {ApplicationException} NOTIFICATION_1003 - 발송 실패
	 */
	async send(payload: PushPayload): Promise<PushResult> {
		if (!this.validateToken(payload.token)) {
			throw new ApplicationException(ErrorCode.NOTIFICATION_1001);
		}

		const messageResult = buildExpoPushMessage(payload);
		if (messageResult.status === "rejected") {
			return this.#toPayloadTooLargeResult(payload.token, messageResult);
		}

		try {
			const tickets = await this.#expo.sendPushNotificationsAsync([messageResult.message]);
			const ticket = tickets[0];

			if (!ticket) {
				throw new ApplicationException(ErrorCode.NOTIFICATION_1003, {
					reason: "No ticket received from Expo",
				});
			}

			return this.#parseTicket(ticket, payload.token);
		} catch (error) {
			// 이미 번역된 애플리케이션 예외는 그대로 재전파
			if (error instanceof ApplicationException) {
				throw error;
			}

			this.#logger.error(`Failed to send push notification: ${error}`);
			throw new ApplicationException(ErrorCode.NOTIFICATION_1003, {
				reason: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}

	/**
	 * 배치 푸시 알림 발송
	 *
	 * Expo는 한 번에 최대 100개의 알림을 발송할 수 있습니다.
	 * 이 메서드는 내부적으로 청크를 나누어 처리합니다.
	 *
	 * Expo error ticket처럼 payload 단위로 확정된 실패는 result로 반환한다. SDK/HTTP
	 * transport가 청크 단위로 실패하면 수락 여부를 확인할 수 없으므로 typed retryable
	 * error를 던진다. 이전 청크의 성공 ticket은 이미 수락되었을 수 있어 호출자가 전체
	 * 논리 배치를 재시도할 때 at-least-once 중복 전달이 가능하다.
	 */
	async sendBatch(payloads: PushPayload[]): Promise<BatchPushResult> {
		const orderedResults: Array<PushResult | undefined> = Array(payloads.length);
		const invalidTokens: string[] = [];

		// 유효한 토큰과 Expo payload 크기 제한을 모두 통과한 메시지만 전송한다.
		const sendableEntries: Array<{
			payload: PushPayload;
			originalIndex: number;
			message: ExpoPushMessage;
		}> = [];
		for (const [originalIndex, payload] of payloads.entries()) {
			if (!this.validateToken(payload.token)) {
				invalidTokens.push(payload.token);
				orderedResults[originalIndex] = {
					token: payload.token,
					success: false,
					error: "Invalid Expo push token",
					errorCode: "NOTIFICATION_1001",
				};
				continue;
			}

			const messageResult = buildExpoPushMessage(payload);
			if (messageResult.status === "rejected") {
				orderedResults[originalIndex] = this.#toPayloadTooLargeResult(payload.token, messageResult);
				continue;
			}

			sendableEntries.push({
				payload,
				originalIndex,
				message: messageResult.message,
			});
		}

		if (sendableEntries.length === 0) {
			return {
				total: payloads.length,
				successCount: 0,
				failureCount: payloads.length,
				results: orderedResults.filter((result) => result !== undefined),
				invalidTokens,
			};
		}

		const messages = sendableEntries.map(({ message }) => message);

		// Expo는 내부적으로 청크를 나눠서 처리
		const chunks = this.#expo.chunkPushNotifications(messages);

		let nextSendableEntryIndex = 0;
		let acceptedTicketCount = 0;
		for (const chunk of chunks) {
			let tickets: ExpoPushTicket[];
			try {
				tickets = await this.#expo.sendPushNotificationsAsync(chunk);
			} catch (error) {
				const transportError = new RetryablePushProviderTransportError(
					{
						providerName: this.name,
						resolvedPayloadCountBeforeFailure: nextSendableEntryIndex,
						acceptedTicketCountBeforeFailure: acceptedTicketCount,
						unconfirmedPayloadCount: chunk.length,
						unattemptedPayloadCount: Math.max(
							sendableEntries.length - nextSendableEntryIndex - chunk.length,
							0,
						),
					},
					{ cause: error },
				);
				this.#logger.error(
					transportError.message,
					error instanceof Error ? error.stack : undefined,
				);
				throw transportError;
			}

			for (let i = 0; i < chunk.length; i++) {
				const ticket = tickets[i];
				const entry = sendableEntries[nextSendableEntryIndex];
				nextSendableEntryIndex++;

				if (!ticket || !entry) {
					if (entry)
						orderedResults[entry.originalIndex] = {
							token: entry.payload.token,
							success: false,
							error: "No ticket or payload",
							errorCode: "NOTIFICATION_1003",
						};
					continue;
				}

				const result = this.#parseTicket(ticket, entry.payload.token);
				if (result.success) acceptedTicketCount++;

				if (!result.success && result.errorCode === "DeviceNotRegistered") {
					invalidTokens.push(entry.payload.token);
				}

				orderedResults[entry.originalIndex] = result;
			}
		}

		const results = orderedResults.filter((result) => result !== undefined);
		const successCount = results.filter((r) => r.success).length;

		return {
			total: payloads.length,
			successCount,
			failureCount: payloads.length - successCount,
			results,
			invalidTokens,
		};
	}

	#toPayloadTooLargeResult(
		token: string,
		result: Extract<ExpoPushMessageBuildResult, { status: "rejected" }>,
	): PushResult {
		return {
			token,
			success: false,
			error: `Push payload is ${result.byteLength} bytes; Expo limit is ${result.maxByteLength} bytes`,
			errorCode: EXPO_MESSAGE_TOO_BIG_ERROR_CODE,
		};
	}

	/**
	 * Expo 티켓을 PushResult로 변환
	 */
	#parseTicket(ticket: ExpoPushTicket, token: string): PushResult {
		if (ticket.status === "ok") {
			return {
				token,
				success: true,
				ticketId: ticket.id,
			};
		}

		// 에러 케이스
		const errorMessage = ticket.message ?? "Unknown error";
		const errorCode = ticket.details?.error ?? "NOTIFICATION_1003";

		this.#logger.warn(`Push notification failed: error=${errorMessage}, code=${errorCode}`);

		return {
			token,
			success: false,
			error: errorMessage,
			errorCode,
		};
	}
}
