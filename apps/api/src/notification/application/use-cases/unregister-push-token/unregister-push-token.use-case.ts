import { Injectable } from "@nestjs/common";
import { PushDeliveryService } from "../../services/push-delivery.service";

/**
 * 푸시 토큰 해제 유스케이스.
 *
 * deviceId가 있으면 해당 기기 토큰만, 없으면 사용자의 모든 토큰을 해제한다.
 */
@Injectable()
export class UnregisterPushTokenUseCase {
	constructor(private readonly pushDeliveryService: PushDeliveryService) {}

	async execute(userId: string, deviceId?: string): Promise<void> {
		if (deviceId) {
			await this.pushDeliveryService.unregisterPushToken(userId, deviceId);
		} else {
			await this.pushDeliveryService.unregisterAllPushTokens(userId);
		}
	}
}
