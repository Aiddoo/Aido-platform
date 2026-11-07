import { useAppVersionService, useErrorReporter } from '@src/bootstrap/providers/di-context';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { ArrowRightIcon, HStack, SettingsCard, Text, useConfirmDialog } from '@src/shared/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Spinner } from 'heroui-native';

import { AppVersionPolicy } from '../domains/app-version.model';
import { useOpenStoreListingMutationOptions } from '../queries/app-version.mutations';
import { useGetAppVersionQueryOptions } from '../queries/app-version.queries';

/** 설치된 버전을 보여 주고, 누르면 스토어 업데이트가 필요한지 확인한다. */
export function AppVersionCheck() {
  const { t } = useTranslation('appVersion');
  const appVersionService = useAppVersionService();
  const errorReporter = useErrorReporter();
  const toast = useAppToast();
  const confirmDialog = useConfirmDialog();
  const installation = appVersionService.getInstallation();
  const query = useQuery({ ...useGetAppVersionQueryOptions(), enabled: false });
  const openStoreListing = useMutation(useOpenStoreListingMutationOptions());

  const handlePress = useSingleTap(async () => {
    const result = await query.refetch();
    if (result.isError || !result.data || !installation) {
      if (result.error) {
        errorReporter.captureException(result.error, { feature: 'app_version' });
      }
      toast.error(t('checkFailed'));
      return;
    }

    const input = { config: result.data, ...installation };
    if (!AppVersionPolicy.canDecide(input)) {
      toast.error(t('checkFailed'));
      return;
    }

    if (AppVersionPolicy.isOutdated(input)) {
      openStoreListing.mutate();
      return;
    }

    if (AppVersionPolicy.isUpToDate(input)) {
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
    <SettingsCard label={t('section')}>
      <SettingsCard.Item
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
    </SettingsCard>
  );
}
