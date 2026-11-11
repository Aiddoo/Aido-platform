import {
  type PlanningContext,
  PlanningContextReaderPort,
} from "#api/modules/voice/action-plans/application/ports/planning-context.reader.port";

const STUB_PLANNING_CONTEXT: PlanningContext = {
  categories: [{ id: 1, name: "업무" }],
  upcomingTodos: [],
};

export class StubPlanningContextReader extends PlanningContextReaderPort {
  readonly #context: PlanningContext;

  constructor(context: PlanningContext = STUB_PLANNING_CONTEXT) {
    super();
    this.#context = context;
  }

  async read(): Promise<PlanningContext> {
    return this.#context;
  }

  async findOwnedCategoryIds(): Promise<ReadonlySet<number>> {
    return new Set(this.#context.categories.map((category) => category.id));
  }
}
