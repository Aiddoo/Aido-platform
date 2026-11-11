import { PinoLogger } from "nestjs-pino";

// 출력하지 않고 경고·오류 로그 인자만 모은다(로그에 개인정보가 없는지 확인할 때 쓴다)
export class RecordingPinoLogger extends PinoLogger {
  readonly warnings: unknown[][] = [];
  readonly errors: unknown[][] = [];

  constructor() {
    super({ pinoHttp: { level: "silent" } });
  }

  override setContext(): void {}

  override warn(...args: unknown[]): void {
    this.warnings.push(args);
  }

  override error(...args: unknown[]): void {
    this.errors.push(args);
  }
}
