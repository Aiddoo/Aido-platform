import { useAppVersionService, useErrorReporter } from '@src/bootstrap/providers/di-context';
import { toError } from '@src/shared/errors';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { ArrowRightIcon, HStack, SettingNavigation, Text, useConfirmDialog } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { Spinner } from 'heroui-native';

import { AppVersionPolicy } from '../domains/app-version.model';
import { useGetAppVersionQueryOptions } from '../queries/get-app-version-query-options';

/** 설치된 버전을 보여 주고, 누르면 스토어 업데이트가 필요한지 확인한다. */
export function AppVersionCheck() {
  const { t } = useTranslation('appVersion');
  const service = useAppVersionService();
  const errorReporter = useErrorReporter();
  const toast = useAppToast();
  const confirmDialog = useConfirmDialog();
  const installation = service.getInstallation();
  const query = useQuery({ ...useGetAppVersionQueryOptions(), enabled: false });

  const handlePress = useSingleTap(async () => {
    const result = await query.refetch();
    if (result.isError || !result.data || !installation) {
      if (result.error) {
        errorReporter.captureException(result.error, { feature: 'app_version' });
      }
      toast.error(undefined, { fallback: t('checkFailed') });
      return;
    }

    const input = { config: result.data, ...installation };
    if (!AppVersionPolicy.canDecide(input)) {
      toast.error(undefined, { fallback: t('checkFailed') });
      return;
    }

    if (AppVersionPolicy.shouldOpenStore(input)) {
      try {
        await service.openStoreListing();
      } catch (error) {
        errorReporter.captureException(toError(error), { feature: 'app_version' });
        toast.error(undefined, { fallback: t('storeOpenFailed') });
      }
      return;
    }

    if (AppVersionPolicy.shouldShowLatestDialog(input)) {
      return confirmDialog.open({
        title: t('latestTitle'),
        description: t('latestDescription'),
        confirmLabel: t('confirm'),
      });
    }
  });

  if (!installation) {
    return null;
  }

  return (
    <SettingNavigation label={t('section')}>
      <SettingNavigation.Item
        label={t('item')}
        onPress={handlePress}
        isDisabled={query.isFetching}
        right={
          <HStack align="center" gap={8}>
            <Text size="b3" shade={6} numberOfLines={1}>
              {installation.currentVersion}
            </Text>
            {query.isFetching ? (
              <Spinner size="sm" />
            ) : (
              <ArrowRightIcon colorClassName="text-gray-6" />
            )}
          </HStack>
        }
      />
    </SettingNavigation>
  );
}
