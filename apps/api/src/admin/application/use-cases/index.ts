import { BroadcastNotificationHandler } from "./broadcast-notification/broadcast-notification.handler";
import { SendTargetedNotificationHandler } from "./send-targeted-notification/send-targeted-notification.handler";

/** 모듈 등록용 커맨드 핸들러 목록 */
export const CommandHandlers = [
	BroadcastNotificationHandler,
	SendTargetedNotificationHandler,
];
