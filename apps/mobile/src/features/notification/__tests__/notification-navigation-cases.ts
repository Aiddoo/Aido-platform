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

export const NAVIGATION_CASES = navigationCasesSchema.parse(
  JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')),
);

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
