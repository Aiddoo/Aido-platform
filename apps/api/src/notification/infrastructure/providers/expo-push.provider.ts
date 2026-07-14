import { ErrorCode } from "@aido/errors";
import { Injectable, Logger } from "@nestjs/common";
import Expo, {
	type ExpoPushMessage,
	type ExpoPushTicket,
} from "expo-server-sdk";

import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import type {
	BatchPushResult,
	PushPayload,
	PushProvider,
	PushReceiptResult,
	PushResult,
} from "../../application/ports/push-provider.port";

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

	constructor() {
		this.#expo = new Expo();
	}

	/**
	 * Expo 푸시 토큰 유효성 검증
	 *
	 * Expo 토큰 형식: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
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
	 * @throws {BusinessException} NOTIFICATION_1001 - 유효하지 않은 토큰
	 * @throws {BusinessException} NOTIFICATION_1003 - 발송 실패
	 */
	async send(payload: PushPayload): Promise<PushResult> {
		if (!this.validateToken(payload.token)) {
			throw new ApplicationException(ErrorCode.NOTIFICATION_1001, {
				token: payload.token,
			});
		}

		const message = this.#buildMessage(payload);

		try {
			const tickets = await this.#expo.sendPushNotificationsAsync([message]);
			const ticket = tickets[0];

			if (!ticket) {
				throw new ApplicationException(ErrorCode.NOTIFICATION_1003, {
					reason: "No ticket received from Expo",
					token: payload.token,
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
				token: payload.token,
			});
		}
	}

	/**
	 * 배치 푸시 알림 발송
	 *
	 * Expo는 한 번에 최대 100개의 알림을 발송할 수 있습니다.
	 * 이 메서드는 내부적으로 청크를 나누어 처리합니다.
	 *
	 * 배치 발송에서는 개별 실패를 result로 반환하고 예외를 던지지 않음
	 * (부분 성공 허용)
	 */
	async sendBatch(payloads: PushPayload[]): Promise<BatchPushResult> {
		const orderedResults: Array<PushResult | undefined> = Array(
			payloads.length,
		);
		const invalidTokens: string[] = [];

		// 유효한 토큰만 필터링
		const validPayloads: Array<{
			payload: PushPayload;
			originalIndex: number;
		}> = [];
		for (const [originalIndex, payload] of payloads.entries()) {
			if (this.validateToken(payload.token)) {
				validPayloads.push({ payload, originalIndex });
			} else {
				invalidTokens.push(payload.token);
				orderedResults[originalIndex] = {
					token: payload.token,
					success: false,
					error: "Invalid Expo push token",
					errorCode: "NOTIFICATION_1001",
				};
			}
		}

		if (validPayloads.length === 0) {
			return {
				total: payloads.length,
				successCount: 0,
				failureCount: payloads.length,
				results: orderedResults.filter((result) => result !== undefined),
				invalidTokens,
			};
		}

		// 메시지 빌드
		const messages = validPayloads.map(({ payload }) =>
			this.#buildMessage(payload),
		);

		// Expo는 내부적으로 청크를 나눠서 처리
		const chunks = this.#expo.chunkPushNotifications(messages);

		let processedIndex = 0;
		for (const chunk of chunks) {
			try {
				const tickets = await this.#expo.sendPushNotificationsAsync(chunk);

				for (let i = 0; i < tickets.length; i++) {
					const ticket = tickets[i];
					const entry = validPayloads[processedIndex];
					processedIndex++;

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

					if (!result.success && result.errorCode === "DeviceNotRegistered") {
						invalidTokens.push(entry.payload.token);
					}

					orderedResults[entry.originalIndex] = result;
				}
			} catch (error) {
				this.#logger.error(`Failed to send batch notifications: ${error}`);
				// 청크 전체 실패 처리
				for (let i = 0; i < chunk.length; i++) {
					const entry = validPayloads[processedIndex];
					processedIndex++;
					if (entry)
						orderedResults[entry.originalIndex] = {
							token: entry.payload.token,
							success: false,
							error: error instanceof Error ? error.message : "Unknown error",
							errorCode: "NOTIFICATION_1003",
						};
				}
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

	/**
	 * PushPayload를 ExpoPushMessage로 변환
	 */
	#buildMessage(payload: PushPayload): ExpoPushMessage {
		return {
			to: payload.token,
			title: payload.title,
			body: payload.body,
			data: payload.data,
			badge: payload.badge,
			sound: payload.sound ?? "default",
			channelId: payload.channelId ?? "default",
			categoryId: payload.categoryId,
			priority: payload.priority ?? "high",
			ttl: payload.ttl,
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

		this.#logger.warn(
			`Push notification failed for token ${token}: ${errorMessage} (${errorCode})`,
		);

		return {
			token,
			success: false,
			error: errorMessage,
			errorCode,
		};
	}
}
