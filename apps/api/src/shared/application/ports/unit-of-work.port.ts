export const UNIT_OF_WORK = Symbol("UNIT_OF_WORK");

/** Required propagation joins the active UoW; repositories read its connection through CLS. */
export interface UnitOfWorkPort {
  run<T>(work: () => Promise<T>): Promise<T>;
}
