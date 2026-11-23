import type { AppLogger } from '@src/core/ports/app-logger';

import { createConsoleLogger } from './console-logger';

const fallback = createConsoleLogger({ minLevel: 'debug' });
let instance: AppLogger = fallback;

export function setGlobalLogger(logger: AppLogger): void {
  instance = logger;
}

export const logger: AppLogger = {
  debug: (...parameters) => instance.debug(...parameters),
  info: (...parameters) => instance.info(...parameters),
  warn: (...parameters) => instance.warn(...parameters),
  error: (...parameters) => instance.error(...parameters),
};
