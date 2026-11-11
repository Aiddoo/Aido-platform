import type { SyncStorage } from '@src/core/ports/sync-storage';
import { upsellDismissalStoredValue } from '@src/features/billing/subscription/schemas/upsell-dismissal-storage.schema';
import { widgetHeadlessFailureStoredValue } from '@src/features/device/widget/schemas/widget-headless-failure-storage.schema';
import { deviceTimezoneStoredValue } from '@src/features/notification/schemas/device-timezone-storage.schema';
import { pushNoticeDismissedAtStoredValue } from '@src/features/notification/schemas/push-notice-dismissed-at-storage.schema';
import { pushPermissionDeferredAtStoredValue } from '@src/features/notification/schemas/push-permission-deferred-at-storage.schema';
import { calendarViewModeStoredValue } from '@src/features/planning/todo/schemas/calendar-view-mode-storage.schema';
import { allDoneBannerStoredValue } from '@src/features/social/invite/schemas/all-done-banner-storage.schema';
import { installReferrerCheckedStoredValue } from '@src/features/social/invite/schemas/install-referrer-checked-storage.schema';
import { pawPrintCelebrationStoredValue } from '@src/features/social/invite/schemas/paw-print-celebration-storage.schema';
import { pendingRedemptionStoredValue } from '@src/features/social/invite/schemas/pending-redemption-storage.schema';
import { offlineModelDeclinedStoredValue } from '@src/features/voice/schemas/offline-model-declined-storage.schema';
import { recognitionLanguageStoredValue } from '@src/features/voice/schemas/recognition-language-storage.schema';
import { toInstant } from '@src/shared/date/instant';
import { createMemorySyncStorage } from '@src/testing/core';

import {
  readStoredValue,
  type StoredValueDefinition,
  type StoredValueScope,
  writeStoredValue,
} from '../define-stored-value';

const SAVED_AT = '2026-11-09T01:02:03.000Z';

/** 출시된 앱이 남긴 키·원문과 지금 정의가 읽는 값. 읽은 값을 다시 쓰면 원문이 그대로여야 한다 */
function releasedValue<TValue, TScope>(
  definition: StoredValueDefinition<TValue, TScope>,
  scope: StoredValueScope<TScope>,
  released: { key: string; raw: string; value: TValue; area: 'device' | 'account' },
) {
  return {
    ...released,
    definitionArea: definition.area,
    readAndRewrite: (storage: SyncStorage) => {
      const value = readStoredValue(storage, definition, ...scope);
      writeStoredValue(storage, definition, value, ...scope);
      return value;
    },
  };
}

const RELEASED_VALUES = [
  {
    name: 'calendarViewModeStoredValue',
    ...releasedValue(calendarViewModeStoredValue, [], {
      key: 'aido_calendar_view_mode',
      raw: 'month',
      value: 'month',
      area: 'device',
    }),
  },
  {
    name: 'allDoneBannerStoredValue',
    ...releasedValue(allDoneBannerStoredValue, ['user-1'], {
      key: 'aido_invite_all_done_banner_dismissed_v1:user-1',
      raw: '2026-11-11',
      value: '2026-11-11',
      area: 'device',
    }),
  },
  {
    name: 'pawPrintCelebrationStoredValue',
    ...releasedValue(pawPrintCelebrationStoredValue, ['user-1'], {
      key: 'aido_invite_paw_print_celebrated_v1:user-1',
      raw: '3',
      value: 3,
      area: 'device',
    }),
  },
  {
    name: 'recognitionLanguageStoredValue',
    ...releasedValue(recognitionLanguageStoredValue, ['user@1'], {
      key: 'aido_recognition_language_v1:user%401',
      raw: 'en-US',
      value: 'en-US',
      area: 'account',
    }),
  },
  {
    name: 'offlineModelDeclinedStoredValue',
    ...releasedValue(offlineModelDeclinedStoredValue, [{ accountId: 'user@1', locale: 'ko-KR' }], {
      key: 'aido_offline_model_declined_v1:user%401:ko-KR',
      raw: 'declined',
      value: 'declined',
      area: 'account',
    }),
  },
  {
    name: 'upsellDismissalStoredValue',
    ...releasedValue(upsellDismissalStoredValue, ['user-1'], {
      key: 'aido_upsell_dismissed_v1:user-1',
      raw: '{"AI_PARSE":"2026-11-10","FUTURE_FEATURE":"2026-11-01"}',
      value: { AI_PARSE: '2026-11-10', FUTURE_FEATURE: '2026-11-01' },
      area: 'device',
    }),
  },
  {
    name: 'pushPermissionDeferredAtStoredValue',
    ...releasedValue(pushPermissionDeferredAtStoredValue, ['user-1'], {
      key: 'aido_push_permission_prompt_deferred_v1:user-1',
      raw: SAVED_AT,
      value: toInstant(SAVED_AT),
      area: 'device',
    }),
  },
  {
    name: 'pushNoticeDismissedAtStoredValue',
    ...releasedValue(pushNoticeDismissedAtStoredValue, ['user-1'], {
      key: 'aido_push_permission_prompt_dismissed_v1:user-1',
      raw: SAVED_AT,
      value: toInstant(SAVED_AT),
      area: 'device',
    }),
  },
  {
    name: 'widgetHeadlessFailureStoredValue',
    ...releasedValue(widgetHeadlessFailureStoredValue, [], {
      key: 'aido_widget_headless_failure_v1',
      raw: '{"method":"handleWidgetTask","name":"Error","message":"activity unavailable"}',
      value: { method: 'handleWidgetTask', name: 'Error', message: 'activity unavailable' },
      area: 'device',
    }),
  },
  {
    name: 'pendingRedemptionStoredValue',
    ...releasedValue(pendingRedemptionStoredValue, [], {
      key: 'aido_invite_pending_v1',
      raw: `{"inviteCode":"K7M2QX","source":"kakao","savedAt":"${SAVED_AT}"}`,
      value: { inviteCode: 'K7M2QX', source: 'kakao', savedAt: toInstant(SAVED_AT) },
      area: 'device',
    }),
  },
  {
    name: 'installReferrerCheckedStoredValue',
    ...releasedValue(installReferrerCheckedStoredValue, [], {
      key: 'aido_install_referrer_checked_v1',
      raw: '1',
      value: '1',
      area: 'device',
    }),
  },
  {
    name: 'deviceTimezoneStoredValue',
    ...releasedValue(deviceTimezoneStoredValue, [], {
      key: 'aido_device_timezone_v1',
      raw: '{"userId":"user-1","deviceTimezone":{"timeZone":"Asia/Seoul","offsetMinutes":540}}',
      value: { userId: 'user-1', deviceTimezone: { timeZone: 'Asia/Seoul', offsetMinutes: 540 } },
      area: 'device',
    }),
  },
];

describe('StoredValueDefinition', () => {
  it.each(RELEASED_VALUES)(
    '$name: 출시된 앱이 남긴 키와 원문을 같은 값으로 읽고, 다시 써도 원문이 그대로다',
    ({ key, raw, value, area, definitionArea, readAndRewrite }) => {
      // Given
      const storage = createMemorySyncStorage();
      storage.set(key, raw);

      // When
      const read = readAndRewrite(storage);

      // Then
      expect(read).toEqual(value);
      expect(storage.get(key)).toBe(raw);
      expect(storage.keys()).toEqual([key]);
      expect(definitionArea).toBe(area);
    },
  );
});
