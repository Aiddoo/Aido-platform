import {
  useLinkAccountMutationOptions,
  useUnlinkAccountMutationOptions,
} from '@src/features/identity/auth/queries/auth.mutations';
import { useGetLinkedAccountsQueryOptions } from '@src/features/identity/auth/queries/auth.queries';
import type {
  OAuthProvider,
  OAuthProviderSlug,
} from '@src/features/identity/auth/schemas/oauth.schema';
import { getProviderState } from '@src/features/identity/auth/utils/get-provider-state';
import { useTranslation } from '@src/shared/i18n';
import {
  AppleIcon,
  Box,
  Button,
  ConfirmDialog,
  GoogleIcon,
  HStack,
  KakaoIcon,
  ListRow,
  NaverIcon,
  QueryErrorBoundary,
  SettingsCard,
  SettingsScreenLayout,
  Text,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { Chip, Skeleton, SkeletonGroup, Spinner } from 'heroui-native';
import { Fragment, memo, type ReactNode, Suspense, useCallback, useState } from 'react';
import { match } from 'ts-pattern';

function LinkedAccountsScreen() {
  const { t } = useTranslation('auth');

  return (
    <SettingsScreenLayout gap={8}>
      <Text size="b4" shade={6} className="px-2">
        {t('linkedAccounts.description')}
      </Text>

      <QueryErrorBoundary fallback={SettingsCard.Error}>
        <Suspense fallback={<LinkedAccountsList.Loading />}>
          <LinkedAccountsList />
        </Suspense>
      </QueryErrorBoundary>
    </SettingsScreenLayout>
  );
}

export default LinkedAccountsScreen;

const PROVIDER_ROW_COUNT = process.env.EXPO_OS === 'ios' ? 4 : 3;

function LinkedAccountsList() {
  const { t } = useTranslation(['auth', 'common']);
  const { data: linkedAccounts } = useSuspenseQuery(useGetLinkedAccountsQueryOptions());
  const {
    mutate: link,
    isPending: isLinking,
    variables: linkingSlug,
  } = useMutation(useLinkAccountMutationOptions());
  const {
    mutate: unlink,
    isPending: isUnlinking,
    variables: unlinkingProvider,
  } = useMutation(useUnlinkAccountMutationOptions());
  const [unlinkTarget, setUnlinkTarget] = useState<{
    provider: OAuthProvider;
    label: string;
  } | null>(null);

  const getProviderRowState = (provider: OAuthProvider, slug: OAuthProviderSlug) =>
    getProviderState({
      accounts: linkedAccounts.accounts,
      provider,
      slug,
      linkingSlug: isLinking ? linkingSlug : undefined,
      unlinkingProvider: isUnlinking ? unlinkingProvider : undefined,
    });

  const handleUnlinkConfirm = () => {
    if (!unlinkTarget) {
      return;
    }
    const target = unlinkTarget;
    setUnlinkTarget(null);
    unlink(target.provider);
  };

  const handleUnlinkRequest = useCallback((provider: OAuthProvider, label: string) => {
    setUnlinkTarget({ provider, label });
  }, []);

  return (
    <>
      <SettingsCard>
        <ProviderListRow
          provider="KAKAO"
          slug="kakao"
          icon={<KakaoIcon width={18} height={18} />}
          iconClassName="bg-yellow-300"
          label={t('providers.KAKAO')}
          {...getProviderRowState('KAKAO', 'kakao')}
          canUnlink={linkedAccounts.canUnlink}
          onLink={link}
          onUnlinkRequest={handleUnlinkRequest}
        />
        <SettingsCard.Separator />
        <ProviderListRow
          provider="GOOGLE"
          slug="google"
          icon={<GoogleIcon width={18} height={18} />}
          iconClassName="bg-white border border-gray-2"
          label={t('providers.GOOGLE')}
          {...getProviderRowState('GOOGLE', 'google')}
          canUnlink={linkedAccounts.canUnlink}
          onLink={link}
          onUnlinkRequest={handleUnlinkRequest}
        />
        {process.env.EXPO_OS === 'ios' && (
          <>
            <SettingsCard.Separator />
            <ProviderListRow
              provider="APPLE"
              slug="apple"
              icon={
                <AppleIcon width={18} height={18} colorClassName="text-white dark:text-black" />
              }
              iconClassName="bg-apple-button dark:bg-apple-button-dark"
              label={t('providers.APPLE')}
              {...getProviderRowState('APPLE', 'apple')}
              canUnlink={linkedAccounts.canUnlink}
              onLink={link}
              onUnlinkRequest={handleUnlinkRequest}
            />
          </>
        )}
        <SettingsCard.Separator />
        <ProviderListRow
          provider="NAVER"
          slug="naver"
          icon={<NaverIcon width={18} height={18} colorClassName="text-white" />}
          iconClassName="bg-success"
          label={t('providers.NAVER')}
          {...getProviderRowState('NAVER', 'naver')}
          canUnlink={linkedAccounts.canUnlink}
          onLink={link}
          onUnlinkRequest={handleUnlinkRequest}
        />
      </SettingsCard>

      <UnlinkConfirmDialog
        targetLabel={unlinkTarget?.label}
        onConfirm={handleUnlinkConfirm}
        onClose={() => setUnlinkTarget(null)}
      />
    </>
  );
}

interface UnlinkConfirmDialogProps {
  targetLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

function UnlinkConfirmDialog({ targetLabel, onConfirm, onClose }: UnlinkConfirmDialogProps) {
  const { t } = useTranslation(['auth', 'common']);

  return (
    <ConfirmDialog
      isOpen={targetLabel != null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      title={<ConfirmDialog.Title>{t('linkedAccounts.unlinkDialogTitle')}</ConfirmDialog.Title>}
      description={
        <ConfirmDialog.Description>
          {t('linkedAccounts.unlinkDialogMessage', { provider: targetLabel ?? '' })}
        </ConfirmDialog.Description>
      }
      cancelButton={
        <ConfirmDialog.CancelButton onPress={onClose}>
          {t('common:actions.cancel')}
        </ConfirmDialog.CancelButton>
      }
      confirmButton={
        <ConfirmDialog.ConfirmButton onPress={onConfirm}>
          {t('linkedAccounts.unlink')}
        </ConfirmDialog.ConfirmButton>
      }
    />
  );
}

LinkedAccountsList.Loading = function Loading() {
  return (
    <SettingsCard>
      <SkeletonGroup isLoading isSkeletonOnly>
        {range(PROVIDER_ROW_COUNT).map((index) => (
          <Fragment key={`linked-account-skeleton-${index}`}>
            <SkeletonRow />
            {index < PROVIDER_ROW_COUNT - 1 && <SettingsCard.Separator />}
          </Fragment>
        ))}
      </SkeletonGroup>
    </SettingsCard>
  );
};

function SkeletonRow() {
  return (
    <HStack align="center" gap={12} className="px-4 py-4">
      <Skeleton className="size-10 rounded-full dark:bg-gray-2" />
      <VStack flex={1} gap={2}>
        <Skeleton className="h-5 w-16 rounded dark:bg-gray-2" />
        <Skeleton className="h-4 w-12 rounded dark:bg-gray-2" />
      </VStack>
      <Skeleton className="h-8 w-16 rounded-lg dark:bg-gray-2" />
    </HStack>
  );
}

interface ProviderListRowProps {
  provider: OAuthProvider;
  slug: OAuthProviderSlug;
  icon: ReactNode;
  iconClassName: string;
  label: string;
  isLinked: boolean;
  isPending: boolean;
  canUnlink: boolean;
  onLink: (slug: OAuthProviderSlug) => void;
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
        <Box className={cn('w-10 h-10 rounded-full items-center justify-center', iconClassName)}>
          {icon}
        </Box>
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
            <Text
              size="e2"
              weight="medium"
              className={isLinked ? 'text-accent-soft-foreground' : 'text-default-soft-foreground'}
            >
              {isLinked ? t('linkedAccounts.linked') : t('linkedAccounts.notLinked')}
            </Text>
          </Chip>
        </VStack>
      }
      right={match({ isPending, isLinked })
        .with({ isPending: true }, () => (
          <Box className="w-16 items-center">
            <Spinner size="sm" />
          </Box>
        ))
        .with({ isPending: false, isLinked: true }, () => (
          <Button size="small" variant="weak" onPress={handleUnlinkPress} isDisabled={!canUnlink}>
            {t('linkedAccounts.unlink')}
          </Button>
        ))
        .with({ isPending: false, isLinked: false }, () => (
          <Button size="small" onPress={handleLinkPress}>
            {t('linkedAccounts.connect')}
          </Button>
        ))
        .exhaustive()}
    />
  );
});
