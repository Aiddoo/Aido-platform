import { useAppIconService } from '@src/bootstrap/providers/di-context';
import { AppIconSelector } from '@src/features/device/app-icon/components/app-icon-selector';
import { useTranslation } from '@src/shared/i18n';
import {
  AppIconDuoIcon,
  QueryErrorBoundary,
  SettingsListGroup,
  SettingsScreenLayout,
} from '@src/shared/ui';
import { Stack } from 'expo-router';
import { Suspense } from 'react';
import { match } from 'ts-pattern';

export default function AppIconScreen() {
  const { t } = useTranslation(['appIcon', 'settings']);
  // 지원 여부는 기기의 동기 값이라 쿼리 없이 읽는다
  const isAvailable = useAppIconService().isAvailable();

  return (
    <>
      <Stack.Screen options={{ title: t('settings:titles.appIcon') }} />

      <SettingsScreenLayout>
        {match(isAvailable)
          .with(false, () => (
            <SettingsListGroup.Empty
              icon={<SettingsListGroup.Icon Icon={AppIconDuoIcon} />}
              title={t('screen.unsupported')}
            />
          ))
          .with(true, () => (
            <SettingsListGroup label={t('screen.label')}>
              <QueryErrorBoundary fallback={AppIconSelector.Error}>
                <Suspense fallback={<AppIconSelector.Loading />}>
                  <AppIconSelector />
                </Suspense>
              </QueryErrorBoundary>
            </SettingsListGroup>
          ))
          .exhaustive()}
      </SettingsScreenLayout>
    </>
  );
}
