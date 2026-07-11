import { Injectable } from "@nestjs/common";
import type { RegisterPushTokenData } from "../../ports/notification-data";
import { PushDeliveryService } from "../../services/push-delivery.service";

/**
 * 푸시 토큰 등록 유스케이스.
 *
 * 토큰 형식 검증(NOTIFICATION_1001), upsert, 타임존·로케일 반영은 푸시 전송
 * 콜라보레이터(PushDeliveryService)가 소유한다.
 */
@Injectable()
export class RegisterPushTokenUseCase {
	constructor(private readonly pushDeliveryService: PushDeliveryService) {}

	async execute(data: RegisterPushTokenData): Promise<void> {
		await this.pushDeliveryService.registerPushToken(data);
	}
}
