import { useAppIconService } from '@src/bootstrap/providers/di-context';
import { AppIconPicker } from '@src/features/device/app-icon/components/app-icon-picker';
import { AppIconSelector } from '@src/features/device/app-icon/components/app-icon-selector';
import { useTranslation } from '@src/shared/i18n';
import {
  HStack,
  QueryErrorBoundary,
  SettingsListGroup,
  SettingsScreenLayout,
  Text,
} from '@src/shared/ui';
import { Suspense } from 'react';
import { match } from 'ts-pattern';

export default function AppIconScreen() {
  const { t } = useTranslation('appIcon');
  // 지원 여부는 기기의 동기 값이라 쿼리 없이 읽는다
  const isSupported = useAppIconService().isSupported();

  return (
    <SettingsScreenLayout gap={8}>
      {match(isSupported)
        .with(false, () => (
          <HStack justify="center" align="center">
            <Text size="b4" shade={6}>
              {t('screen.unsupported')}
            </Text>
          </HStack>
        ))
        .with(true, () => (
          <>
            <Text size="b4" shade={6} className="px-2">
              {t('screen.chooseIcon')}
            </Text>

            <SettingsListGroup>
              <SettingsListGroup.Content>
                <QueryErrorBoundary fallback={AppIconPicker.Error}>
                  <Suspense fallback={<AppIconPicker.Loading />}>
                    <AppIconSelector />
                  </Suspense>
                </QueryErrorBoundary>
              </SettingsListGroup.Content>
            </SettingsListGroup>
          </>
        ))
        .exhaustive()}
    </SettingsScreenLayout>
  );
}
