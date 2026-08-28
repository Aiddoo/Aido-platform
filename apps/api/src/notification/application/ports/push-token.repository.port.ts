import type { PushTokenRecord } from "../../domain/records/notification.record";
import type { FindPushTokensParams, RegisterPushTokenData } from "./notification-data";

export const PUSH_TOKEN_REPOSITORY = Symbol("PUSH_TOKEN_REPOSITORY");

export class PushTokenNotFoundError extends Error {
	constructor() {
		super("Push token not found");
		this.name = "PushTokenNotFoundError";
	}
}

/** Expo 등록 토큰의 생명주기를 소유하는 영속성 포트. */
export interface PushTokenRepositoryPort {
	registerPushToken(data: RegisterPushTokenData): Promise<PushTokenRecord>;
	findPushTokensByUser(params: FindPushTokensParams): Promise<PushTokenRecord[]>;
	findActivePushTokensByUsers(userIds: string[]): Promise<PushTokenRecord[]>;
	deletePushToken(userId: string, deviceId: string): Promise<PushTokenRecord>;
	deleteAllPushTokensByUser(userId: string): Promise<{ count: number }>;
	deactivateInvalidTokens(tokens: string[]): Promise<{ count: number }>;
}
