import { EMAIL_DELIVERY_QUEUE as EMAIL_DELIVERY_QUEUE_DEFINITION } from "./email/infrastructure/jobs/email-delivery.queue.js";

// 헬스 체크가 쓰던 큐 이름 문자열 export다. 정의는 email slice의 email-delivery.queue.ts에 있다
export const EMAIL_DELIVERY_QUEUE = EMAIL_DELIVERY_QUEUE_DEFINITION.name;
