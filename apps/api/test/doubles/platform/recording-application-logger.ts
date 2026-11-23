import {
  type ApplicationLogMessage,
  ApplicationLoggerPort,
} from "#api/shared/application/ports/application-logger.port";

type ApplicationLogLevel = "log" | "debug" | "warn" | "error";

interface RecordedLog {
  readonly level: ApplicationLogLevel;
  readonly message: ApplicationLogMessage;
  readonly details: readonly unknown[];
}

// 로그 키·필드가 계약인 관측 테스트(개인정보 비노출 포함)가 수준별로 남긴 로그를 확인한다
export class RecordingApplicationLogger extends ApplicationLoggerPort {
  readonly entries: RecordedLog[] = [];

  log(message: ApplicationLogMessage, ...details: readonly unknown[]): void {
    this.entries.push({ level: "log", message, details });
  }

  debug(message: ApplicationLogMessage, ...details: readonly unknown[]): void {
    this.entries.push({ level: "debug", message, details });
  }

  warn(message: ApplicationLogMessage, ...details: readonly unknown[]): void {
    this.entries.push({ level: "warn", message, details });
  }

  error(message: ApplicationLogMessage, ...details: readonly unknown[]): void {
    this.entries.push({ level: "error", message, details });
  }

  messagesAt(level: ApplicationLogLevel): ApplicationLogMessage[] {
    return this.#at(level).map(({ message }) => message);
  }

  // 개인정보 비노출 확인처럼 부가 인자까지 볼 때 쓴다
  callsAt(level: ApplicationLogLevel): unknown[][] {
    return this.#at(level).map(({ message, details }) => [message, ...details]);
  }

  #at(level: ApplicationLogLevel): RecordedLog[] {
    return this.entries.filter((entry) => entry.level === level);
  }
}
