import { Injectable, type OnModuleInit } from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { MaterializeDueTodoSeriesUseCase } from "../../application/use-cases/materialize-due-todo-series.use-case.js";
import { TODO_SERIES_MATERIALIZATION_QUEUE } from "./todo-series-materialization.queue.js";

@Injectable()
export class TodoSeriesMaterializationProcessor implements OnModuleInit {
  readonly #materializeDueTodoSeries: Pick<MaterializeDueTodoSeriesUseCase, "execute">;
  readonly #jobQueue: JobQueuePort;

  constructor(materializeDueTodoSeries: MaterializeDueTodoSeriesUseCase, jobQueue: JobQueuePort) {
    this.#materializeDueTodoSeries = materializeDueTodoSeries;
    this.#jobQueue = jobQueue;
  }

  async onModuleInit(): Promise<void> {
    await this.#jobQueue.work(TODO_SERIES_MATERIALIZATION_QUEUE, async () => this.process());
  }

  async process(): Promise<void> {
    await this.#materializeDueTodoSeries.execute();
  }
}
