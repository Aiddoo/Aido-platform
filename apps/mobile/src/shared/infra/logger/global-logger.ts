import type { Logger } from '@src/core/ports/logger';
import { createConsoleLogger } from './console-logger';

const fallback = createConsoleLogger({ minLevel: 'debug' });
let instance: Logger = fallback;

export const setGlobalLogger = (logger: Logger): void => {
  instance = logger;
};

export const logger: Logger = {
  debug: (...args) => instance.debug(...args),
  info: (...args) => instance.info(...args),
  warn: (...args) => instance.warn(...args),
  error: (...args) => instance.error(...args),
};
