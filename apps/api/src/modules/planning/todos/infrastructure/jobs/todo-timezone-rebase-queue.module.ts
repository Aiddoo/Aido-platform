import { Module } from "@nestjs/common";

import { TodoTimezoneRebaseQueueService } from "./todo-timezone-rebase-enqueuer.adapter.js";

/** 설정 쓰기는 이 큐만 소비한다. Identity가 할 일 모듈 전체를 import해 순환이 생기지 않게 나눈다. */
@Module({
  providers: [TodoTimezoneRebaseQueueService],
  exports: [TodoTimezoneRebaseQueueService],
})
export class TodoTimezoneRebaseQueueModule {}
