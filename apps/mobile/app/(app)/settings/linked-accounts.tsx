import type { OAuthProvider } from '@src/features/auth/models/oauth.model';
import { PROVIDER_CONFIGS } from '@src/features/auth/presentations/constants/provider-configs.constant';
import { useLinkedAccounts } from '@src/features/auth/presentations/hooks/use-linked-accounts';
import { useTranslation } from '@src/shared/i18n';
import {
  Button,
  ConfirmDialog,
  HStack,
  ListRow,
  QueryErrorBoundary,
  Spacing,
  StyledSafeAreaView,
  Text,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import times from 'es-toolkit/compat/times';
import { Chip, Separator, Skeleton, SkeletonGroup, Spinner } from 'heroui-native';
import type { ReactNode } from 'react';
import { Fragment, memo, Suspense, useCallback, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';

const LinkedAccountsScreen = () => {
  const { t } = useTranslation('auth');
  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <ScrollView className="px-4 flex-1">
        <Spacing size={20} />

        <Text size="b4" shade={6} className="px-2 pb-2">
          {t('linkedAccounts.description')}
        </Text>

        <QueryErrorBoundary>
          <Suspense fallback={<LinkedAccountsList.Loading />}>
            <LinkedAccountsList />
          </Suspense>
        </QueryErrorBoundary>
      </ScrollView>
    </StyledSafeAreaView>
  );
};

export default LinkedAccountsScreen;

const visibleConfigs =
  Platform.OS === 'ios' ? PROVIDER_CONFIGS : PROVIDER_CONFIGS.filter((c) => c.provider !== 'APPLE');

function LinkedAccountsList() {
  const { t } = useTranslation(['auth', 'common']);
  const { canUnlink, getProviderState, link, unlink } = useLinkedAccounts();

  const [unlinkTarget, setUnlinkTarget] = useState<{
    provider: OAuthProvider;
    label: string;
  } | null>(null);

  const handleUnlinkConfirm = () => {
    if (!unlinkTarget) return;
    const target = unlinkTarget;
    setUnlinkTarget(null);
    unlink(target.provider);
  };

  const handleLink = useCallback(
    (slug: (typeof PROVIDER_CONFIGS)[number]['slug']) => {
      link(slug);
    },
    [link],
  );

  const handleUnlinkRequest = useCallback((provider: OAuthProvider, label: string) => {
    setUnlinkTarget({ provider, label });
  }, []);

  return (
    <>
      <VStack className="bg-white rounded-2xl overflow-hidden border border-gray-2">
        {visibleConfigs.map((config, index) => {
          const { isLinked, isPending } = getProviderState(config.provider, config.slug);

          return (
            <Fragment key={config.provider}>
              {index > 0 && <Separator className="mx-4 bg-gray-2" />}
              <ProviderListRow
                provider={config.provider}
                slug={config.slug}
                icon={config.icon}
                iconClassName={config.iconClassName}
                label={t(config.labelKey)}
                isLinked={isLinked}
                isPending={isPending}
                canUnlink={canUnlink}
                onLink={handleLink}
                onUnlinkRequest={handleUnlinkRequest}
              />
            </Fragment>
          );
        })}
      </VStack>

      <ConfirmDialog
        isOpen={unlinkTarget !== null}
        onOpenChange={(open) => {
          if (!open) setUnlinkTarget(null);
        }}
        title={<ConfirmDialog.Title>{t('linkedAccounts.unlinkDialogTitle')}</ConfirmDialog.Title>}
        description={
          <ConfirmDialog.Description>
            {t('linkedAccounts.unlinkDialogMessage', { provider: unlinkTarget?.label ?? '' })}
          </ConfirmDialog.Description>
        }
        cancelButton={
          <ConfirmDialog.CancelButton onPress={() => setUnlinkTarget(null)}>
            {t('common:actions.cancel')}
          </ConfirmDialog.CancelButton>
        }
        confirmButton={
          <ConfirmDialog.ConfirmButton onPress={handleUnlinkConfirm}>
            {t('linkedAccounts.unlink')}
          </ConfirmDialog.ConfirmButton>
        }
      />
    </>
  );
}

LinkedAccountsList.Loading = function Loading() {
  return (
    <VStack className="bg-white rounded-2xl overflow-hidden border border-gray-2">
      <SkeletonGroup isLoading isSkeletonOnly>
        {times(visibleConfigs.length, (index) => (
          <Fragment key={`linked-account-skeleton-${index}`}>
            <SkeletonRow />
            {index < visibleConfigs.length - 1 && <Separator className="mx-4 bg-gray-2" />}
          </Fragment>
        ))}
      </SkeletonGroup>
    </VStack>
  );
};

function SkeletonRow() {
  return (
    <HStack align="center" gap={12} className="px-4 py-4">
      <Skeleton className="size-10 rounded-full" />
      <VStack flex={1} gap={2}>
        <Skeleton className="h-5 w-16 rounded" />
        <Skeleton className="h-4 w-12 rounded" />
      </VStack>
      <Skeleton className="h-8 w-16 rounded-lg" />
    </HStack>
  );
}

interface ProviderListRowProps {
  provider: OAuthProvider;
  slug: (typeof PROVIDER_CONFIGS)[number]['slug'];
  icon: ReactNode;
  iconClassName: string;
  label: string;
  isLinked: boolean;
  isPending: boolean;
  canUnlink: boolean;
  onLink: (slug: (typeof PROVIDER_CONFIGS)[number]['slug']) => void;
  onUnlinkRequest: (provider: OAuthProvider, label: string) => void;
}

const ProviderListRow = memo(function ProviderListRow({
  provider,
  slug,
  icon,
  iconClassName,
  label,
  isLinked,
  isPending,
  canUnlink,
  onLink,
  onUnlinkRequest,
}: ProviderListRowProps) {
  const { t } = useTranslation('auth');
  const handleLinkPress = useCallback(() => {
    onLink(slug);
  }, [onLink, slug]);

  const handleUnlinkPress = useCallback(() => {
    onUnlinkRequest(provider, label);
  }, [onUnlinkRequest, provider, label]);

  return (
    <ListRow
      horizontalPadding="medium"
      verticalPadding="large"
      left={
        <View className={cn('w-10 h-10 rounded-full items-center justify-center', iconClassName)}>
          {icon}
        </View>
      }
      contents={
        <VStack gap={2}>
          <Text size="b3" weight="medium">
            {label}
          </Text>
          <Chip
            variant="soft"
            color={isLinked ? 'accent' : 'default'}
            size="sm"
            className="self-start mt-0.5 px-2 rounded-lg"
          >
            <Chip.Label className="text-e2">
              {isLinked ? t('linkedAccounts.linked') : t('linkedAccounts.notLinked')}
            </Chip.Label>
          </Chip>
        </VStack>
      }
      right={
        isPending ? (
          <View className="w-16 items-center">
            <Spinner size="sm" />
          </View>
        ) : isLinked ? (
          <Button size="small" variant="weak" onPress={handleUnlinkPress} isDisabled={!canUnlink}>
            {t('linkedAccounts.unlink')}
          </Button>
        ) : (
          <Button size="small" onPress={handleLinkPress}>
            {t('linkedAccounts.connect')}
          </Button>
        )
      }
    />
  );
});
