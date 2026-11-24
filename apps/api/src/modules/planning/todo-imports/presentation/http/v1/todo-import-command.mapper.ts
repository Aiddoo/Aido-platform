import type { StartTodoImportCommand } from "../../../application/use-cases/start-todo-import.use-case.js";
import type { TodoImportItemPrimitives } from "../../../domain/todo-import-item.vo.js";
import type { ReceiveTodoImportItemsDto, StartTodoImportDto } from "./todo-import.dto.js";

export function toStartTodoImportCommand(params: {
  readonly userId: string;
  readonly idempotencyKey: string;
  readonly requestedTimezone: string | undefined;
  readonly dto: StartTodoImportDto;
}): StartTodoImportCommand {
  const { dto } = params;
  return {
    userId: params.userId,
    idempotencyKey: params.idempotencyKey,
    requestedTimezone: params.requestedTimezone,
    source: dto.source,
    startDate: Temporal.PlainDate.from(dto.startDate),
    endDate: Temporal.PlainDate.from(dto.endDate),
    timeMode: dto.timeMode,
    visibility: dto.visibility,
    targets: dto.targets,
    collections: dto.collections,
  };
}

export function toTodoImportItems(dto: ReceiveTodoImportItemsDto): TodoImportItemPrimitives[] {
  return dto.items.map((item) => ({
    sourceKey: item.sourceKey,
    collectionKey: item.collectionKey,
    title: item.title,
    startDate: Temporal.PlainDate.from(item.startDate),
    endDate: item.endDate == null ? null : Temporal.PlainDate.from(item.endDate),
    localTime: item.localTime,
  }));
}
