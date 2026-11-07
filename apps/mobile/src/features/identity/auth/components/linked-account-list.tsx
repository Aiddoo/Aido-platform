import { useTranslation } from '@src/shared/i18n';
import {
  AppleIcon,
  Box,
  Button,
  GoogleIcon,
  HStack,
  KakaoIcon,
  ListRow,
  NaverIcon,
  SettingsListGroup,
  Text,
  useConfirmDialog,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { Chip, Skeleton, SkeletonGroup, Spinner } from 'heroui-native';
import { Fragment, type ReactNode } from 'react';
import { match } from 'ts-pattern';

import { getOAuthProviderLabel } from '../constants/auth-provider-labels';
import {
  useLinkAccountMutationOptions,
  useUnlinkAccountMutationOptions,
} from '../queries/auth.mutations';
import { useGetLinkedAccountsQueryOptions } from '../queries/auth.queries';
import type { OAuthProvider, OAuthProviderSlug } from '../schemas/oauth.schema';
import { getProviderState } from '../utils/get-provider-state';

interface ProviderRowConfig {
  provider: OAuthProvider;
  slug: OAuthProviderSlug;
  icon: ReactNode;
  iconClassName: string;
}

const PROVIDER_ROWS: readonly ProviderRowConfig[] = [
  {
    provider: 'KAKAO',
    slug: 'kakao',
    icon: <KakaoIcon width={18} height={18} />,
    iconClassName: 'bg-yellow-300',
  },
  {
    provider: 'GOOGLE',
    slug: 'google',
    icon: <GoogleIcon width={18} height={18} />,
    iconClassName: 'bg-white border border-gray-2',
  },
  ...(process.env.EXPO_OS === 'ios'
    ? [
        {
          provider: 'APPLE',
          slug: 'apple',
          icon: <AppleIcon width={18} height={18} colorClassName="text-white dark:text-black" />,
          iconClassName: 'bg-apple-button dark:bg-apple-button-dark',
        } satisfies ProviderRowConfig,
      ]
    : []),
  {
    provider: 'NAVER',
    slug: 'naver',
    icon: <NaverIcon width={18} height={18} colorClassName="text-white" />,
    iconClassName: 'bg-success',
  },
];

export function LinkedAccountList() {
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
  const confirmDialog = useConfirmDialog();

  const requestUnlink = async (provider: OAuthProvider) => {
    const isConfirmed = await confirmDialog.open({
      title: t('linkedAccounts.unlinkDialogTitle'),
      description: t('linkedAccounts.unlinkDialogMessage', {
        provider: getOAuthProviderLabel(provider),
      }),
      confirmLabel: t('linkedAccounts.unlink'),
      cancelLabel: t('common:actions.cancel'),
    });
    if (isConfirmed) {
      unlink(provider);
    }
  };

  return (
    <SettingsListGroup>
      {PROVIDER_ROWS.map(({ provider, slug, icon, iconClassName }, index) => {
        const { isLinked, isPending } = getProviderState({
          accounts: linkedAccounts.accounts,
          provider,
          slug,
          linkingSlug: isLinking ? linkingSlug : undefined,
          unlinkingProvider: isUnlinking ? unlinkingProvider : undefined,
        });

        return (
          <Fragment key={provider}>
            {index > 0 && <SettingsListGroup.Separator />}
            <ProviderRow
              icon={icon}
              iconClassName={iconClassName}
              label={getOAuthProviderLabel(provider)}
              isLinked={isLinked}
              isPending={isPending}
              canUnlink={linkedAccounts.canUnlink}
              onLink={() => link(slug)}
              onUnlink={() => requestUnlink(provider)}
            />
          </Fragment>
        );
      })}
    </SettingsListGroup>
  );
}

const PROVIDER_ROW_COUNT = PROVIDER_ROWS.length;

LinkedAccountList.Loading = function Loading() {
  return (
    <SettingsListGroup>
      <SkeletonGroup isLoading isSkeletonOnly>
        {range(PROVIDER_ROW_COUNT).map((index) => (
          <Fragment key={`linked-account-skeleton-${index}`}>
            <ProviderRow.Skeleton />
            {index < PROVIDER_ROW_COUNT - 1 && <SettingsListGroup.Separator />}
          </Fragment>
        ))}
      </SkeletonGroup>
    </SettingsListGroup>
  );
};

interface ProviderRowProps {
  icon: ReactNode;
  iconClassName: string;
  label: string;
  isLinked: boolean;
  isPending: boolean;
  canUnlink: boolean;
  onLink: () => void;
  onUnlink: () => void;
}

function ProviderRow({
  icon,
  iconClassName,
  label,
  isLinked,
  isPending,
  canUnlink,
  onLink,
  onUnlink,
}: ProviderRowProps) {
  const { t } = useTranslation('auth');

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
          <Button size="small" variant="weak" onPress={onUnlink} isDisabled={!canUnlink}>
            {t('linkedAccounts.unlink')}
          </Button>
        ))
        .with({ isPending: false, isLinked: false }, () => (
          <Button size="small" onPress={onLink}>
            {t('linkedAccounts.connect')}
          </Button>
        ))
        .exhaustive()}
    />
  );
}

ProviderRow.Skeleton = function ProviderRowSkeleton() {
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
};
