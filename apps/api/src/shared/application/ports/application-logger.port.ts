export type ApplicationLogMessage = string | Readonly<{ event: string; [field: string]: unknown }>;

export abstract class ApplicationLoggerPort {
  abstract log(message: ApplicationLogMessage, ...details: readonly unknown[]): void;
  abstract debug(message: ApplicationLogMessage, ...details: readonly unknown[]): void;
  abstract warn(message: ApplicationLogMessage, ...details: readonly unknown[]): void;
  abstract error(message: ApplicationLogMessage, ...details: readonly unknown[]): void;
}
