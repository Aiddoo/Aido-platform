import { BroadcastNotificationUseCase } from "./broadcast-notification/broadcast-notification.use-case";
import { SendTargetedNotificationUseCase } from "./send-targeted-notification/send-targeted-notification.use-case";

/** 모듈 등록용 use-case 목록 */
export const AdminUseCases = [BroadcastNotificationUseCase, SendTargetedNotificationUseCase];
