import { SavepointRunnerPort } from "#api/shared/application/ports/savepoint-runner.port";

// savepoint 없이 바로 실행한다. 부분 rollback은 실제 PostgreSQL integration에서 본다
export class ImmediateSavepointRunner extends SavepointRunnerPort {
  run<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}
