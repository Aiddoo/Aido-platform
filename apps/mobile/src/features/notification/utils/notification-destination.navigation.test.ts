import { NOTIFICATION_NAVIGATION_KIND, NOTIFICATION_TYPE } from '@aido/api/vocabulary';
import type { WindowSizeClass } from '@src/shared/utils/get-window-size-class';

import { NAVIGATION_CASES, toLegacySource } from '../__tests__/notification-navigation-cases';
import { resolveNotificationDestination } from './notification-destination';

const WINDOW_SIZE_CLASSES: readonly WindowSizeClass[] = ['compact', 'medium', 'expanded'];
const OWNER_ID = 'cmfriend00000000000000001';
const VIEWER_IDS = [undefined, OWNER_ID, 'cmviewer00000000000000001'];
const OPTION_COMBINATIONS = WINDOW_SIZE_CLASSES.flatMap((windowSizeClass) =>
  VIEWER_IDS.map((viewerId) => ({ windowSizeClass, viewerId, today: '2026-11-06' })),
);

describe('서버 navigation과 구 필드 대조', () => {
  it('31개 알림 타입이 모두 대조표에 있다', () => {
    // Given
    const types = new Set(NAVIGATION_CASES.map(({ source }) => source.type));

    // When
    const missing = Object.values(NOTIFICATION_TYPE).filter((type) => !types.has(type));

    // Then
    expect(Object.values(NOTIFICATION_TYPE)).toHaveLength(31);
    expect(missing).toEqual([]);
  });

  it('19개 navigation kind가 모두 대조표에 있다', () => {
    // Given
    const kinds = new Set(NAVIGATION_CASES.map(({ navigation }) => navigation?.kind));

    // When
    const missing = Object.values(NOTIFICATION_NAVIGATION_KIND).filter((kind) => !kinds.has(kind));

    // Then
    expect(Object.values(NOTIFICATION_NAVIGATION_KIND)).toHaveLength(19);
    expect(missing).toEqual([]);
  });

  describe.each(OPTION_COMBINATIONS)('$windowSizeClass, 나 $viewerId', (options) => {
    it.each(
      NAVIGATION_CASES.flatMap(({ navigation, knownDifference, name, source }) =>
        navigation == null || knownDifference != null ? [] : [{ name, navigation, source }],
      ),
    )('$name: navigation과 구 필드가 같은 곳으로 간다', ({ navigation, source }) => {
      // When
      const legacySource = toLegacySource(source);
      const fromServer = resolveNotificationDestination({ ...legacySource, navigation }, options);
      const fromLegacy = resolveNotificationDestination(legacySource, options);

      // Then
      expect(fromServer).toEqual(fromLegacy);
    });
  });

  it.each(
    NAVIGATION_CASES.flatMap(({ navigation, knownDifference, name, source }) =>
      navigation == null || knownDifference == null ? [] : [{ name, navigation, source }],
    ),
  )('$name: 알려진 차이는 실제로 다른 곳으로 간다', ({ navigation, source }) => {
    // Given
    const options = { windowSizeClass: 'compact', today: '2026-11-06' } as const;

    // When
    const legacySource = toLegacySource(source);
    const fromServer = resolveNotificationDestination({ ...legacySource, navigation }, options);
    const fromLegacy = resolveNotificationDestination(legacySource, options);

    // Then
    expect(fromServer).not.toEqual(fromLegacy);
  });
});

describe('푸시 호환', () => {
  const OPTIONS = { windowSizeClass: 'compact', today: '2026-11-06' } as const;

  it('모르는 타입이어도 navigation이 있으면 따른다', () => {
    // When
    const destination = resolveNotificationDestination(
      { type: null, navigation: { kind: 'ACHIEVEMENTS' } },
      OPTIONS,
    );

    // Then
    expect(destination).toEqual({ kind: 'route', href: '/achievements' });
  });

  it('모르는 타입에 navigation도 없으면 알림 목록으로 간다', () => {
    // When
    const destination = resolveNotificationDestination({ type: null }, OPTIONS);

    // Then
    expect(destination).toEqual({ kind: 'route', href: '/notifications' });
  });
});
