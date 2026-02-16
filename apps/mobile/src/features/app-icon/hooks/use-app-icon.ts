import * as AppIcon from 'expo-quick-actions/icon';
import { useCallback, useEffect, useState } from 'react';
import type { AppIconKey } from '../types/app-icon.types';

const APP_ICON_KEYS = new Set<AppIconKey>([
  'default',
  'scottish_fold',
  'orange_tabby',
  'black_cat',
  'white_cat',
  'siamese',
]);

/**
 * 네이티브 모듈이 반환한 아이콘 이름을 {@link AppIconKey}로 변환한다.
 *
 * `expo-quick-actions/icon`의 `getIcon()`은 현재 활성 아이콘 이름 또는
 * 기본 아이콘일 때 `null`을 반환한다. 등록되지 않은 값이나 `null`은
 * `'default'`로 폴백한다.
 */
const resolveIconKey = (nativeValue: string | null): AppIconKey => {
  if (nativeValue === null) return 'default';
  return APP_ICON_KEYS.has(nativeValue as AppIconKey) ? (nativeValue as AppIconKey) : 'default';
};

/**
 * {@link AppIconKey}를 네이티브 모듈이 기대하는 아이콘 이름으로 변환한다.
 *
 * `expo-quick-actions/icon`의 `setIcon()`에 `null`을 전달하면
 * 기본 앱 아이콘으로 복원된다.
 *
 * @see https://github.com/EvanBacon/expo-quick-actions/blob/main/src/icon.ts
 */
const toNativeIconName = (key: AppIconKey): string | null => {
  if (key === 'default') return null;
  return key;
};

/**
 * 앱 아이콘 변경 기능을 제공하는 훅.
 *
 * `expo-quick-actions/icon` (v6) 네이티브 모듈을 래핑하며,
 * 현재 아이콘 조회·변경·지원 여부 확인을 처리한다.
 *
 * ### 플랫폼별 동작
 * | 플랫폼 | 동작 |
 * |--------|------|
 * | **iOS** | 아이콘이 즉시 변경된다 (런타임 핫스왑). |
 * | **Android** | `setIcon()` 호출 시 **앱이 종료(재시작)**된다. activity-alias 전환에 의한 OS 레벨 제약이다. |
 *
 * > Android 재시작 동작은 `expo-quick-actions`뿐 아니라 모든 동적 아이콘 라이브러리에 공통이다.
 * > 호출부에서 Android인 경우 사전 확인 Dialog를 표시하는 것을 권장한다.
 *
 * @returns currentIcon - 현재 활성 앱 아이콘 키
 * @returns isSupported - 디바이스의 동적 아이콘 변경 지원 여부
 * @returns isChanging - 아이콘 변경 진행 중 여부 (중복 호출 방지용)
 * @returns changeIcon - 아이콘 변경 함수. 동일 아이콘이거나 변경 중이면 무시된다.
 *
 * @see https://github.com/EvanBacon/expo-quick-actions
 *
 * @example
 * ```tsx
 * const { currentIcon, isSupported, isChanging, changeIcon } = useAppIcon();
 *
 * // Android에서는 재시작 경고 후 호출
 * if (Platform.OS === 'android') {
 *   showRestartDialog(() => changeIcon('black_cat'));
 * } else {
 *   changeIcon('black_cat');
 * }
 * ```
 */
export const useAppIcon = () => {
  const [currentIcon, setCurrentIcon] = useState<AppIconKey>('default');
  const [isChanging, setIsChanging] = useState(false);
  const isSupported = AppIcon.isSupported;

  useEffect(() => {
    if (!isSupported) return;

    AppIcon.getIcon?.().then((nativeValue) => {
      setCurrentIcon(resolveIconKey(nativeValue));
    });
  }, []);

  const changeIcon = useCallback(
    async (key: AppIconKey) => {
      if (key === currentIcon || isChanging) return;

      setIsChanging(true);

      try {
        await AppIcon.setIcon?.(toNativeIconName(key));
        setCurrentIcon(key);
      } finally {
        setIsChanging(false);
      }
    },
    [currentIcon, isChanging],
  );

  return { currentIcon, isSupported, isChanging, changeIcon };
};
