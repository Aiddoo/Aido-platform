import { useApplicationMetadata } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { ArrowRightIcon, HStack, SettingsListGroup, Text, useConfirmDialog } from '@src/shared/ui';
import { useAppToast } from '@src/shared/ui';
import { onlineManager, useMutation, useQuery } from '@tanstack/react-query';
import { Spinner } from 'heroui-native';
import { match } from 'ts-pattern';

import { AppVersionPolicy } from '../domains/app-version.model';
import { useOpenStoreListingMutationOptions } from '../queries/app-version.mutations';
import { useGetAppVersionQueryOptions } from '../queries/app-version.queries';

export function AppVersionCheck() {
  const { t } = useTranslation('appVersion');
  const applicationMetadata = useApplicationMetadata();
  const toast = useAppToast();
  const { trackEvent } = useTrack();
  const confirmDialog = useConfirmDialog();
  const spinnerColor = useResolvedColor('text-accent');
  const installation = applicationMetadata.getInstallation();
  const query = useQuery({ ...useGetAppVersionQueryOptions(), enabled: false });
  const openStoreListing = useMutation(useOpenStoreListingMutationOptions());

  const handlePress = useSingleTap(async () => {
    // 오프라인이면 조회가 연결될 때까지 멈춰 버튼이 돌지도 않는다. 연결된 뒤 뒤늦게 스토어가 열리지 않도록 바로 알린다
    if (!onlineManager.isOnline()) {
      toast.warning(t('checkOffline'));
      return;
    }

    // 조회 실패의 보고는 전역 조회 캐시가 한다
    const result = await query.refetch();
    if (result.isError || result.data == null || installation == null) {
      toast.error(t('checkFailed'));
      return;
    }

    if (!result.data.enabled) {
      toast.toast(t('noUpdateInfo'));
      return;
    }

    await match(AppVersionPolicy.getUpdateStatus({ config: result.data, ...installation }))
      .with('unknown', () => {
        toast.error(t('checkFailed'));
      })
      .with('outdated', () => {
        openStoreListing.mutate(undefined, {
          onSuccess: () => trackEvent('app_update_store_opened', { source: 'settings' }),
        });
      })
      .with('up-to-date', () =>
        confirmDialog.openAsync({
          title: t('latestTitle'),
          description: t('latestDescription'),
          confirmLabel: t('confirm'),
        }),
      )
      .exhaustive();
  });

  if (!installation) {
    return null;
  }

  return (
    <SettingsListGroup label={t('section')}>
      <SettingsListGroup.Item
        label={t('item')}
        accessibilityHint={t('itemHint')}
        accessibilityState={{ busy: query.isFetching }}
        onPress={handlePress}
        isDisabled={query.isFetching}
        right={
          <HStack align="center" gap={8}>
            <Text size="b3" shade={6} numberOfLines={1}>
              {installation.currentVersion}
            </Text>
            {query.isFetching ? (
              <Spinner size="sm" color={spinnerColor} />
            ) : (
              <ArrowRightIcon colorClassName="text-gray-6" />
            )}
          </HStack>
        }
      />
    </SettingsListGroup>
  );
}
