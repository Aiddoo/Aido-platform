import {
  type ApplicationLogMessage,
  ApplicationLoggerPort,
} from "#api/shared/application/ports/application-logger.port";

// 출력하지 않고 남긴 로그만 모은다(로그에 개인정보가 없는지 확인할 때 쓴다)
export class SilentLogger extends ApplicationLoggerPort {
  readonly messages: ApplicationLogMessage[] = [];

  log(message: ApplicationLogMessage): void {
    this.messages.push(message);
  }

  debug(message: ApplicationLogMessage): void {
    this.messages.push(message);
  }

  warn(message: ApplicationLogMessage): void {
    this.messages.push(message);
  }

  error(message: ApplicationLogMessage): void {
    this.messages.push(message);
  }
}
