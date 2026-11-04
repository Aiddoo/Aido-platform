import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";

import { JOB_POLLING_SECONDS } from "#api/shared/application/ports/index";
import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import { MaterializeDueTodoSeries } from "../../../application/use-cases/series/materialize-due-todo-series.use-case.js";
import { TODO_SERIES_MATERIALIZATION_QUEUE } from "./todo-series-materialization.queue.constants.js";

@Injectable()
export class TodoSeriesMaterializationProcessor implements OnModuleInit {
  constructor(
    @Inject(MaterializeDueTodoSeries)
    private readonly materializeDueTodoSeries: Pick<MaterializeDueTodoSeries, "execute">,
    @Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.runtime.work(TODO_SERIES_MATERIALIZATION_QUEUE, async () => this.process(), {
      teamSize: 1,
      pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND,
    });
  }

  async process(): Promise<void> {
    await this.materializeDueTodoSeries.execute();
  }
}
