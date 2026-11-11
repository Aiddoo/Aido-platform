import {
  type AfterCommitTask,
  AfterCommitTaskRegistryPort,
} from "#api/shared/application/ports/after-commit-task.registry.port";

// 커밋 뒤 작업을 실행하지 않고 모아 두어 테스트가 "커밋"을 직접 흉내 낸다
export class RecordingAfterCommitRegistry extends AfterCommitTaskRegistryPort {
  readonly tasks: AfterCommitTask[] = [];

  register(task: AfterCommitTask): void {
    this.tasks.push(task);
  }

  async runAll(): Promise<void> {
    for (const task of this.tasks) {
      await task();
    }
  }
}
