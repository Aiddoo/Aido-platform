import { createRuleTester } from '../rule-tester.mjs';
import rules from './errors.mjs';

const tester = createRuleTester();

tester.run('no-error-field-access', rules['no-error-field-access'], {
  valid: [
    'if (isTodoNotFoundError(error)) {}',
    "permission.status === 'granted';",
    'featureAccess.status;',
    'receipt.details != null;',
    'error.message;',
    'error.code;',
    'const { code, message } = error;',
    'const { status } = permission;',
    'isError.valueOf();',
    'error[key];',
  ],
  invalid: [
    { code: 'error.status === HttpStatus.NOT_FOUND;', errors: 1 },
    { code: 'result.error.status === HttpStatus.TOO_MANY_REQUESTS;', errors: 1 },
    { code: 'const remaining = error.details?.remainingSeconds;', errors: 1 },
    { code: 'err.statusCode === 503;', errors: 1 },
    { code: 'failure.serverCode === ErrorCode.WEATHER_1901;', errors: 1 },
    { code: "error['status'] === 404;", errors: 1 },
    { code: 'const { status, details } = error;', errors: 2 },
    { code: 'const { status: httpStatus } = result.error;', errors: 1 },
    { code: 'e.status === 429;', errors: 1 },
    { code: 'apiError.details;', errors: 1 },
  ],
});
