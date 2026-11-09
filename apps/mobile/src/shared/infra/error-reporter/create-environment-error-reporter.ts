import type { ErrorReporter } from '@src/core/ports/error-reporter';
import { ENV } from '@src/shared/config/env';

import { createConsoleErrorReporter } from './console-error-reporter';
import { createSentryErrorReporter } from './sentry-error-reporter';

export function createEnvironmentErrorReporter(): ErrorReporter {
  return ENV.IS_PRODUCTION ? createSentryErrorReporter() : createConsoleErrorReporter();
}
