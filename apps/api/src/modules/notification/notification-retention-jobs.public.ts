import { RETENTION_QUEUE as RETENTION_QUEUE_DEFINITION } from "./retention/infrastructure/jobs/retention.queue.js";

// 다른 Context가 쓰던 큐 이름 문자열 export다. 정의는 retention slice의 retention.queue.ts에 있다
export const RETENTION_QUEUE = RETENTION_QUEUE_DEFINITION.name;
