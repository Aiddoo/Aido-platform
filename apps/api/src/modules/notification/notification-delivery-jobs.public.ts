import { MARKETING_CONSENT_RECONFIRM_QUEUE as MARKETING_CONSENT_RECONFIRM_QUEUE_DEFINITION } from "./push/infrastructure/jobs/marketing-consent-reconfirm.queue.js";
import {
  NOTIFICATION_DEAD_LETTER_QUEUE as NOTIFICATION_DEAD_LETTER_QUEUE_DEFINITION,
  NOTIFICATION_QUEUE as NOTIFICATION_QUEUE_DEFINITION,
} from "./push/infrastructure/jobs/notification.queue.js";
import {
  PUSH_DELIVERY_DEAD_LETTER_QUEUE as PUSH_DELIVERY_DEAD_LETTER_QUEUE_DEFINITION,
  PUSH_DELIVERY_QUEUE as PUSH_DELIVERY_QUEUE_DEFINITION,
} from "./push/infrastructure/jobs/push-delivery.queue.js";

// 다른 Context가 쓰던 큐 이름 문자열 export다. 정의는 push slice의 *.queue.ts에 있다
export const NOTIFICATION_QUEUE = NOTIFICATION_QUEUE_DEFINITION.name;
export const NOTIFICATION_DEAD_LETTER_QUEUE = NOTIFICATION_DEAD_LETTER_QUEUE_DEFINITION.name;
export const PUSH_DELIVERY_QUEUE = PUSH_DELIVERY_QUEUE_DEFINITION.name;
export const PUSH_DELIVERY_DEAD_LETTER_QUEUE = PUSH_DELIVERY_DEAD_LETTER_QUEUE_DEFINITION.name;
export const MARKETING_CONSENT_RECONFIRM_QUEUE = MARKETING_CONSENT_RECONFIRM_QUEUE_DEFINITION.name;

/** Identity 설정에서 큐만 참조할 때 Delivery의 설정 조회 모듈을 다시 초기화하지 않는다. */
export { NotificationQueueModule } from "./push/infrastructure/jobs/notification-queue.module.js";
export {
  NotificationQueueAdapter,
  NotificationQueueAdapter as NotificationQueueService,
} from "./push/infrastructure/jobs/notification-queue.adapter.js";
