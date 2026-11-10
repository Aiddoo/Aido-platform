import { Injectable } from "@nestjs/common";

import { resolveDeadLetterQueue, type QueueDefinition } from "#api/shared/application/ports/index";

// Health가 따로 이름 목록을 들고 있지 않아도 이 프로세스가 쓰는 큐와 그 DLQ를 모두 보게 한다
@Injectable()
export class JobQueueRegistry {
  readonly #names = new Set<string>();

  register(queue: QueueDefinition<object>): void {
    this.#names.add(queue.name);
    const deadLetterQueue = resolveDeadLetterQueue(queue.deadLetter);
    if (deadLetterQueue != null) {
      this.#names.add(deadLetterQueue);
    }
  }

  queueNames(): readonly string[] {
    return [...this.#names];
  }
}
