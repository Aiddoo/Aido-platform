import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ErrorCode, type ErrorCodeType, hasPublicErrorDetails } from '@aido/api/errors';

const SRC_ROOT = join(__dirname, '../..');

// 서버 details를 읽는 *.error.ts와 그 코드. 운영 서버는 PUBLIC_ERROR_DETAILS에 등록한 코드의 details만 보내므로
// details를 새로 읽으면 여기에 더하고 @aido/api에 등록한다(등록이 빠지면 운영에서만 값이 비어 VERIFY_0753처럼 깨진다)
const DETAILS_READERS: Record<string, readonly ErrorCodeType[]> = {
  'features/billing/subscription/domains/entitlement.error.ts': [
    ErrorCode.AI_1301,
    ErrorCode.AI_1302,
    ErrorCode.AI_1303,
    ErrorCode.AI_1310,
    ErrorCode.AI_1312,
    ErrorCode.AI_1313,
    ErrorCode.AI_1314,
    ErrorCode.AI_1318,
    ErrorCode.CHEER_1201,
    ErrorCode.FOLLOW_0909,
    ErrorCode.NUDGE_1101,
    ErrorCode.TODO_CATEGORY_0857,
  ],
  'features/identity/auth/domains/auth.error.ts': [ErrorCode.VERIFY_0753],
  'features/planning/todo/domains/todo-series.error.ts': [ErrorCode.TODO_0842, ErrorCode.TODO_0845],
  'features/social/friend/domains/friend.error.ts': [ErrorCode.FOLLOW_0909],
};

const DETAILS_READ = /\.details\b|ErrorDetailsSchema\b/;

const errorFiles = readdirSync(SRC_ROOT, { recursive: true, encoding: 'utf8' })
  .filter((path) => path.endsWith('.error.ts'))
  .map((path) => path.split('\\').join('/'));

describe('hasPublicErrorDetails', () => {
  it('details를 읽는 *.error.ts는 모두 읽는 코드 표에 있다', () => {
    // When
    const readers = errorFiles.filter((path) =>
      DETAILS_READ.test(readFileSync(join(SRC_ROOT, path), 'utf8')),
    );

    // Then
    expect(readers.sort()).toEqual(Object.keys(DETAILS_READERS).sort());
  });

  it.each(Object.entries(DETAILS_READERS))(
    '%s가 읽는 코드는 운영 응답에도 details가 실린다',
    (_path, codes) => {
      // When
      const hidden = codes.filter((code) => !hasPublicErrorDetails(code));

      // Then
      expect(hidden).toEqual([]);
    },
  );
});
