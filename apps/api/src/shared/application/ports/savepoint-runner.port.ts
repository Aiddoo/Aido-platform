/**
 * Run items sequentially in an active UoW and roll back only a failed item.
 * Register its after-commit task after run succeeds; the registry is outside this savepoint.
 */
export abstract class SavepointRunnerPort {
  abstract run<T>(work: () => Promise<T>): Promise<T>;
}
