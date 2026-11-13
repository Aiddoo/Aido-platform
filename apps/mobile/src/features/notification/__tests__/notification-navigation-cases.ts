import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { notificationNavigationSchema, notificationTypeSchema } from '@aido/api';
import { z } from 'zod';

/** 서버 spec과 함께 읽는 대조표 한 줄. 앱은 알림 종류와 서버가 고른 navigation만 읽는다 */
const navigationCaseSchema = z.object({
  name: z.string(),
  source: z.object({ type: notificationTypeSchema }),
  navigation: notificationNavigationSchema.nullable(),
});

const FIXTURE_PATH = join(
  __dirname,
  '../../../../../../packages/api/test-fixtures/notification-navigation.cases.json',
);

/** 서버 spec과 함께 읽는 대조표. `dist`에 들어가지 않는 packages/api 테스트 데이터다 */
export const NAVIGATION_CASES = z
  .array(navigationCaseSchema)
  .parse(JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')));
