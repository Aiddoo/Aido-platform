import type { OAuthProvider, OAuthProviderSlug } from '@src/features/auth/domains/oauth.model';
import { useGetLinkedAccountsQueryOptions } from '@src/features/auth/queries/get-linked-accounts-query-options';
import { useLinkAccountMutationOptions } from '@src/features/auth/queries/use-link-account-mutation-options';
import { useUnlinkAccountMutationOptions } from '@src/features/auth/queries/use-unlink-account-mutation-options';
import { getProviderState } from '@src/features/auth/utils/get-provider-state';
import { useTranslation } from '@src/shared/i18n';
import {
  AppleIcon,
  Button,
  ConfirmDialog,
  GoogleIcon,
  HStack,
  KakaoIcon,
  ListRow,
  NaverIcon,
  QueryErrorBoundary,
  Spacing,
  StyledSafeAreaView,
  Text,
  VStack,
  Box,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { Chip, Separator, Skeleton, SkeletonGroup, Spinner } from 'heroui-native';
import type { ReactNode } from 'react';
import { Fragment, memo, Suspense, useCallback, useState } from 'react';
import { Platform, ScrollView } from 'react-native';
import { match } from 'ts-pattern';

function LinkedAccountsScreen() {
  const { t } = useTranslation('auth');
  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <ScrollView className="px-4 flex-1">
        <StyledSafeAreaView edges={['left', 'right']}>
          <Spacing size={20} />

          <Text size="b4" shade={6} className="px-2 pb-2">
            {t('linkedAccounts.description')}
          </Text>

          <QueryErrorBoundary>
            <Suspense fallback={<LinkedAccountsList.Loading />}>
              <LinkedAccountsList />
            </Suspense>
          </QueryErrorBoundary>
        </StyledSafeAreaView>
      </ScrollView>
    </StyledSafeAreaView>
  );
}

export default LinkedAccountsScreen;

const PROVIDER_ROW_COUNT = Platform.OS === 'ios' ? 4 : 3;

function LinkedAccountsList() {
  const { t } = useTranslation(['auth', 'common']);
  const { data } = useSuspenseQuery(useGetLinkedAccountsQueryOptions());
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

  const stateOf = (provider: OAuthProvider, slug: OAuthProviderSlug) =>
    getProviderState({
      accounts: data.accounts,
      provider,
      slug,
      linkingSlug: isLinking ? linkingSlug : undefined,
      unlinkingProvider: isUnlinking ? unlinkingProvider : undefined,
    });

  const [unlinkTarget, setUnlinkTarget] = useState<{
    provider: OAuthProvider;
    label: string;
  } | null>(null);

  const handleUnlinkConfirm = () => {
    if (!unlinkTarget) {
      return;
    }
    const target = unlinkTarget;
    setUnlinkTarget(null);
    unlink(target.provider);
  };

  const handleLink = useCallback(
    (slug: OAuthProviderSlug) => {
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
        <ProviderListRow
          provider="KAKAO"
          slug="kakao"
          icon={<KakaoIcon width={18} height={18} />}
          iconClassName="bg-yellow-300"
          label={t('providers.KAKAO')}
          {...stateOf('KAKAO', 'kakao')}
          canUnlink={data.canUnlink}
          onLink={handleLink}
          onUnlinkRequest={handleUnlinkRequest}
        />
        <Separator className="mx-4 bg-gray-2" />
        <ProviderListRow
          provider="GOOGLE"
          slug="google"
          icon={<GoogleIcon width={18} height={18} />}
          iconClassName="bg-white border border-gray-2"
          label={t('providers.GOOGLE')}
          {...stateOf('GOOGLE', 'google')}
          canUnlink={data.canUnlink}
          onLink={handleLink}
          onUnlinkRequest={handleUnlinkRequest}
        />
        {Platform.OS === 'ios' && (
          <>
            <Separator className="mx-4 bg-gray-2" />
            <ProviderListRow
              provider="APPLE"
              slug="apple"
              icon={
                <AppleIcon width={18} height={18} colorClassName="text-white dark:text-black" />
              }
              iconClassName="bg-apple-button dark:bg-apple-button-dark"
              label={t('providers.APPLE')}
              {...stateOf('APPLE', 'apple')}
              canUnlink={data.canUnlink}
              onLink={handleLink}
              onUnlinkRequest={handleUnlinkRequest}
            />
          </>
        )}
        <Separator className="mx-4 bg-gray-2" />
        <ProviderListRow
          provider="NAVER"
          slug="naver"
          icon={<NaverIcon width={18} height={18} colorClassName="text-white" />}
          iconClassName="bg-success"
          label={t('providers.NAVER')}
          {...stateOf('NAVER', 'naver')}
          canUnlink={data.canUnlink}
          onLink={handleLink}
          onUnlinkRequest={handleUnlinkRequest}
        />
      </VStack>

      <ConfirmDialog
        isOpen={unlinkTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setUnlinkTarget(null);
          }
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
        {times(PROVIDER_ROW_COUNT, (index) => (
          <Fragment key={`linked-account-skeleton-${index}`}>
            <SkeletonRow />
            {index < PROVIDER_ROW_COUNT - 1 && <Separator className="mx-4 bg-gray-2" />}
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
            <Chip.Label className="text-e2">
              {isLinked ? t('linkedAccounts.linked') : t('linkedAccounts.notLinked')}
            </Chip.Label>
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
