import { useAppIconService } from '@src/bootstrap/providers/di-context';
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
  const isAvailable = useAppIconService().isAvailable();

  return (
    <SettingsScreenLayout gap={8}>
      {match(isAvailable)
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
                <QueryErrorBoundary fallback={AppIconSelector.Error}>
                  <Suspense fallback={<AppIconSelector.Loading />}>
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
