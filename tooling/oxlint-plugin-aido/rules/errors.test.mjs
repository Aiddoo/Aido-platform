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

tester.run('error-class-location', rules['error-class-location'], {
  valid: [
    'export function memoNotFound(memoId: MemoId) { return new ApplicationException(ErrorCode.MEMO_2001); }',
    'class MemoRepository extends BaseRepository {}',
    'throw new Error("boom");',
    { code: 'throw memoNotFound(memoId);', options: [{ inlineThrow: true }] },
    { code: 'throw error;', options: [{ inlineThrow: true }] },
  ],
  invalid: [
    {
      code: 'export class MemoConflictError extends Error {}',
      errors: [{ message: /MemoConflictError: 오류 클래스\(Error 하위\)는 \*\.errors\.ts에만/ }],
    },
    { code: 'class MemoNotFound extends ApplicationException {}', errors: 1 },
    { code: 'class MemoRetryableError extends MemoConflictError {}', errors: 1 },
    { code: 'const Invalid = class extends DomainException {};', errors: 1 },
    {
      code: 'throw new Error("memo missing");',
      options: [{ inlineThrow: true }],
      errors: [{ message: /throw new Error\(…\)를 바로 쓰지 않는다/ }],
    },
    { code: 'throw TypeError("bad");', options: [{ inlineThrow: true }], errors: 1 },
  ],
});
