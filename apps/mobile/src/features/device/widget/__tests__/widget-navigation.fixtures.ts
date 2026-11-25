import { defineFixture } from '@src/testing/fixture';

import { widgetNavigationCommandStorageSchema } from '../schemas/widget-navigation-command-storage.schema';

// 저장 모양으로 검증해 위젯이 열 수 없는 주소의 명령을 만들지 않는다. 만든 시각은 저장 원문(에포크 ms)으로 적는다
export const createWidgetNavigationCommand = defineFixture(widgetNavigationCommandStorageSchema, {
  id: 'command-1',
  uri: 'aido://feed?date=today',
  userId: 'user-1',
  createdAt: 1_793_836_800_000,
});
