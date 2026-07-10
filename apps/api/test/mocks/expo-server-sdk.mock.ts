/**
 * expo-server-sdk Mock (E2E 전용)
 *
 * v6부터 ESM-only 빌드(import.meta 사용)라 jest 29(CJS)에서 로드할 수
 * 없는 문제를 해결하기 위한 모킹 — jose.mock.ts와 동일한 패턴.
 * E2E는 실제 푸시를 보내지 않으므로 기본 구현만 제공한다.
 */

export class Expo {
	static isExpoPushToken(token: unknown): boolean {
		return (
			typeof token === "string" &&
			(token.startsWith("ExponentPushToken[") ||
				token.startsWith("ExpoPushToken[")) &&
			token.endsWith("]")
		);
	}

	chunkPushNotifications<T>(messages: T[]): T[][] {
		return messages.length > 0 ? [messages] : [];
	}

	async sendPushNotificationsAsync(): Promise<unknown[]> {
		return [];
	}

	async getPushNotificationReceiptsAsync(): Promise<Record<string, unknown>> {
		return {};
	}
}

export default Expo;
