import {
  ExclusiveRunnerPort,
  type ExclusiveRunResult,
} from "#api/shared/application/ports/exclusive-runner.port";

// 프로세스 안에서 키마다 하나만 돌린다. heldKeys에 넣은 키는 다른 인스턴스가 쥔 것으로 본다
export class InMemoryExclusiveRunner extends ExclusiveRunnerPort {
  readonly heldKeys = new Set<string>();

  async run<T>(key: string, work: () => Promise<T>): Promise<ExclusiveRunResult<T>> {
    if (this.heldKeys.has(key)) {
      return { status: "held" };
    }
    this.heldKeys.add(key);
    try {
      return { status: "ran", value: await work() };
    } finally {
      this.heldKeys.delete(key);
    }
  }
}
