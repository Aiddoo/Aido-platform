import type { PushPayload } from "../../application/ports/push-provider.port";
import {
	buildExpoPushMessage,
	EXPO_PUSH_PAYLOAD_MAX_BYTE_LENGTH,
	measureExpoPushMessageByteLength,
} from "./expo-push-message";

const VALID_TOKEN = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

function createPayload(overrides: Partial<PushPayload> = {}): PushPayload {
	return {
		token: VALID_TOKEN,
		title: "알림",
		body: "본문",
		...overrides,
	};
}

describe("Expo push message", () => {
	it("JSON UTF-8 크기가 4096 byte면 전송 가능하다", () => {
		// Given
		const basePayload = createPayload({ data: { padding: "" } });
		const baseResult = buildExpoPushMessage(basePayload);
		if (baseResult.status !== "ready") {
			throw new Error("기준 payload는 Expo 한도 이내여야 합니다");
		}
		const paddingLength = EXPO_PUSH_PAYLOAD_MAX_BYTE_LENGTH - baseResult.byteLength;

		// When
		const result = buildExpoPushMessage(
			createPayload({ data: { padding: "x".repeat(paddingLength) } }),
		);

		// Then
		expect(result).toMatchObject({
			status: "ready",
			byteLength: EXPO_PUSH_PAYLOAD_MAX_BYTE_LENGTH,
		});
	});

	it("JSON UTF-8 크기가 4097 byte면 메시지를 반환하지 않고 거부한다", () => {
		// Given
		const basePayload = createPayload({ data: { padding: "" } });
		const baseResult = buildExpoPushMessage(basePayload);
		if (baseResult.status !== "ready") {
			throw new Error("기준 payload는 Expo 한도 이내여야 합니다");
		}
		const paddingLength = EXPO_PUSH_PAYLOAD_MAX_BYTE_LENGTH + 1 - baseResult.byteLength;

		// When
		const result = buildExpoPushMessage(
			createPayload({ data: { padding: "x".repeat(paddingLength) } }),
		);

		// Then
		expect(result).toEqual({
			status: "rejected",
			reason: "payload-too-large",
			byteLength: EXPO_PUSH_PAYLOAD_MAX_BYTE_LENGTH + 1,
			maxByteLength: EXPO_PUSH_PAYLOAD_MAX_BYTE_LENGTH,
		});
	});

	it("한글·emoji·JSON escape 문자를 UTF-8 byte로 측정한다", () => {
		// Given
		const result = buildExpoPushMessage(
			createPayload({
				title: "고양이 알림 🐾",
				body: '댓글에 인용부호 " 역슬래시 \\ 줄바꿈\n도착',
				data: { message: '한글🐾"\\\n' },
			}),
		);
		if (result.status !== "ready") {
			throw new Error("테스트 payload는 Expo 한도 이내여야 합니다");
		}

		// When
		const serializedMessage = JSON.stringify(result.message);
		const measuredByteLength = measureExpoPushMessageByteLength(result.message);

		// Then
		expect(measuredByteLength).toBe(Buffer.byteLength(serializedMessage, "utf8"));
		expect(measuredByteLength).toBeGreaterThan(serializedMessage.length);
	});
});
