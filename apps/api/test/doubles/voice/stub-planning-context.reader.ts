import { PlanningContextReaderPort } from "#api/modules/voice/action-plans/application/ports/planning-context.reader.port";
import type { PlanningContextReadModel } from "#api/modules/voice/action-plans/application/read-models/planning-context.read-model";

const STUB_PLANNING_CONTEXT: PlanningContextReadModel = {
  categories: [{ id: 1, name: "업무" }],
  upcomingTodos: [],
};

export class StubPlanningContextReader extends PlanningContextReaderPort {
  readonly #context: PlanningContextReadModel;

  constructor(context: PlanningContextReadModel = STUB_PLANNING_CONTEXT) {
    super();
    this.#context = context;
  }

  async read(): Promise<PlanningContextReadModel> {
    return this.#context;
  }

  async findOwnedCategoryIds(): Promise<ReadonlySet<number>> {
    return new Set(this.#context.categories.map((category) => category.id));
  }
}
