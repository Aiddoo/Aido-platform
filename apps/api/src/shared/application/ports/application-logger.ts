export interface ApplicationLogger {
  log(message: string, ...details: readonly unknown[]): void;
  debug(message: string, ...details: readonly unknown[]): void;
  warn(message: string, ...details: readonly unknown[]): void;
  error(message: string, ...details: readonly unknown[]): void;
}
