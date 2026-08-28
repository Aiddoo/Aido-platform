import type { ExpoPushMessage } from "expo-server-sdk";

import type { PushPayload } from "../../application/ports/push-provider.port";

export const EXPO_PUSH_PAYLOAD_MAX_BYTE_LENGTH = 4096;

export type ExpoPushMessageBuildResult =
	| {
			status: "ready";
			message: ExpoPushMessage;
			byteLength: number;
	  }
	| {
			status: "rejected";
			reason: "payload-too-large";
			byteLength: number;
			maxByteLength: typeof EXPO_PUSH_PAYLOAD_MAX_BYTE_LENGTH;
	  };

/**
 * Expo에 전송될 완성된 메시지를 JSON UTF-8 byte 기준으로 측정한다.
 * 한글·emoji·escape 문자는 JavaScript string length와 byte 수가 다르다.
 */
export function measureExpoPushMessageByteLength(message: ExpoPushMessage): number {
	return new TextEncoder().encode(JSON.stringify(message)).byteLength;
}

/** PushPayload를 전송 가능한 Expo 메시지로 만들고 provider 한도를 같이 검증한다. */
export function buildExpoPushMessage(payload: PushPayload): ExpoPushMessageBuildResult {
	const message: ExpoPushMessage = {
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
	const byteLength = measureExpoPushMessageByteLength(message);

	if (byteLength > EXPO_PUSH_PAYLOAD_MAX_BYTE_LENGTH) {
		return {
			status: "rejected",
			reason: "payload-too-large",
			byteLength,
			maxByteLength: EXPO_PUSH_PAYLOAD_MAX_BYTE_LENGTH,
		};
	}

	return { status: "ready", message, byteLength };
}
