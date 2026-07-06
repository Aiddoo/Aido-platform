import { t } from '@src/shared/i18n';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import { useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { match } from 'ts-pattern';

interface UseLocationPermissionReturn {
  /** 권한 있으면 콜백 실행, 없으면 권한 요청 후 처리 */
  requestPermissionAndExecute: (onGranted: () => void) => Promise<void>;
}

/** 설정 앱 열기 */
const openSettings = () => {
  match(Platform.OS)
    .with('ios', () => Linking.openURL('app-settings:'))
    .with('android', 'windows', 'macos', 'web', () => Linking.openSettings())
    .exhaustive();
};

/** 권한 거부 시 설정으로 이동 안내 Alert */
const showPermissionDeniedAlert = () => {
  Alert.alert(t('common:permissions.location.title'), t('common:permissions.location.message'), [
    { text: t('common:permissions.cancel'), style: 'cancel' },
    { text: t('common:permissions.openSettings'), onPress: openSettings },
  ]);
};

/**
 * 위치 권한을 관리하는 Hook
 *
 * @param onDenied - 권한 거부 시 호출되는 콜백 (사용자가 거부했지만 다시 요청 가능한 경우)
 *
 * @example
 * ```tsx
 * const { requestPermissionAndExecute } = useLocationPermission(
 *   (message) => toast.warning(message),
 * );
 *
 * const handlePress = async () => {
 *   await requestPermissionAndExecute(() => {
 *     // 권한 획득 후 실행할 로직
 *     fetchWeather();
 *   });
 * };
 * ```
 */
export const useLocationPermission = (
  onDenied?: (message: string) => void,
): UseLocationPermissionReturn => {
  const requestPermissionAndExecute = useCallback(
    async (onGranted: () => void) => {
      const currentPermission = await Location.getForegroundPermissionsAsync();

      const shouldRequestPermission = match(currentPermission)
        .with({ granted: true }, () => {
          onGranted();
          return false;
        })
        .with({ granted: false, canAskAgain: false }, () => {
          showPermissionDeniedAlert();
          return false;
        })
        .with({ granted: false, canAskAgain: true }, () => true)
        .exhaustive();

      if (!shouldRequestPermission) {
        return;
      }

      const permissionResult = await Location.requestForegroundPermissionsAsync();

      match(permissionResult)
        .with({ granted: true }, () => onGranted())
        .with({ granted: false, canAskAgain: false }, () => showPermissionDeniedAlert())
        .with({ granted: false, canAskAgain: true }, () =>
          onDenied?.(t('common:permissions.location.denied')),
        )
        .exhaustive();
    },
    [onDenied],
  );

  return { requestPermissionAndExecute };
};
