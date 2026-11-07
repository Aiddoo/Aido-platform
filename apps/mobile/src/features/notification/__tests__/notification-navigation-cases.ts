import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  type NavigationCase,
  navigationCasesSchema,
} from '../schemas/notification-navigation-case.schema';
import type { NotificationDestinationSource } from '../utils/notification-destination';

const FIXTURE_PATH = join(
  __dirname,
  '../../../../../../packages/api/test-fixtures/notification-navigation.cases.json',
);

/** 서버 spec과 함께 읽는 대조표. `dist`에 들어가지 않는 packages/api 테스트 데이터다 */
export const NAVIGATION_CASES = navigationCasesSchema.parse(
  JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')),
);

/** 서버가 푸시 data에 싣는 구 필드 모양으로 바꾼다 */
export function toLegacySource({
  type,
  action,
  todoId,
  friendId,
  nudgeId,
  cheerId,
  routing,
}: NavigationCase['source']): NotificationDestinationSource {
  return { type, action, routing, context: { todoId, friendId, nudgeId, cheerId } };
}
