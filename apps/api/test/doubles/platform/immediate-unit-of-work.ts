import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

// 트랜잭션 없이 바로 실행하고, 몇 번 열었는지만 남긴다
export class ImmediateUnitOfWork extends UnitOfWorkPort {
  runCount = 0;

  run<T>(work: () => Promise<T>): Promise<T> {
    this.runCount += 1;
    return work();
  }
}
