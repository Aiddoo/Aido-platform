export type ApplicationLogMessage = string | Readonly<{ event: string; [field: string]: unknown }>;

export interface ApplicationLogger {
  log(message: ApplicationLogMessage, ...details: readonly unknown[]): void;
  debug(message: ApplicationLogMessage, ...details: readonly unknown[]): void;
  warn(message: ApplicationLogMessage, ...details: readonly unknown[]): void;
  error(message: ApplicationLogMessage, ...details: readonly unknown[]): void;
}
