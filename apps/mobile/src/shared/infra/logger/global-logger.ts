import type { AppLogger } from '@src/core/ports/app-logger';

import { createConsoleLogger } from './console-logger';

const fallback = createConsoleLogger({ minLevel: 'debug' });
let instance: AppLogger = fallback;

export function setGlobalLogger(logger: AppLogger): void {
  instance = logger;
}

export const logger: AppLogger = {
  debug: (...args) => instance.debug(...args),
  info: (...args) => instance.info(...args),
  warn: (...args) => instance.warn(...args),
  error: (...args) => instance.error(...args),
};
