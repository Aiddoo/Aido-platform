import { Injectable } from "@nestjs/common";

import { TodoBriefReaderPort } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { ReminderTargetReaderPort } from "../../application/ports/reminder-target.reader.port.js";

@Injectable()
export class ReminderTargetReaderAdapter implements ReminderTargetReaderPort {
  readonly #todoBriefReader: TodoBriefReaderPort;

  constructor(todoBriefReader: TodoBriefReaderPort) {
    this.#todoBriefReader = todoBriefReader;
  }

  countTodosOn(ownerId: UserId, date: Temporal.PlainDate): Promise<number> {
    return this.#todoBriefReader.countTodosOn(ownerId, date);
  }
}
