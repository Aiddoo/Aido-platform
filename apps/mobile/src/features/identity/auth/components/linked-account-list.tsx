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
import { Chip, Skeleton, SkeletonGroup, Spinner } from 'heroui-native';
import type { ReactNode } from 'react';
import { match } from 'ts-pattern';

import { getOAuthProviderLabel } from '../constants/auth-provider-labels';
import {
  useLinkAccountMutationOptions,
  useUnlinkAccountMutationOptions,
} from '../queries/auth.mutations';
import { useGetLinkedAccountsQueryOptions } from '../queries/auth.queries';
import type { OAuthProvider, OAuthProviderSlug } from '../schemas/oauth.schema';

export function LinkedAccountList() {
  return (
    <SettingsListGroup>
      <ProviderRow
        provider="KAKAO"
        slug="kakao"
        icon={<KakaoIcon width={18} height={18} />}
        iconClassName="bg-yellow-300"
      />

      <SettingsListGroup.Separator />

      <ProviderRow
        provider="GOOGLE"
        slug="google"
        icon={<GoogleIcon width={18} height={18} />}
        iconClassName="bg-white border border-gray-2"
      />

      {process.env.EXPO_OS === 'ios' && (
        <>
          <SettingsListGroup.Separator />

          <ProviderRow
            provider="APPLE"
            slug="apple"
            icon={<AppleIcon width={18} height={18} colorClassName="text-white dark:text-black" />}
            iconClassName="bg-apple-button dark:bg-apple-button-dark"
          />
        </>
      )}

      <SettingsListGroup.Separator />

      <ProviderRow
        provider="NAVER"
        slug="naver"
        icon={<NaverIcon width={18} height={18} colorClassName="text-white" />}
        iconClassName="bg-success"
      />
    </SettingsListGroup>
  );
}

LinkedAccountList.Loading = function Loading() {
  return (
    <SettingsListGroup>
      <SkeletonGroup isLoading isSkeletonOnly>
        <ProviderRow.Skeleton />

        <SettingsListGroup.Separator />

        <ProviderRow.Skeleton />

        {process.env.EXPO_OS === 'ios' && (
          <>
            <SettingsListGroup.Separator />

            <ProviderRow.Skeleton />
          </>
        )}

        <SettingsListGroup.Separator />

        <ProviderRow.Skeleton />
      </SkeletonGroup>
    </SettingsListGroup>
  );
};

interface ProviderRowProps {
  provider: OAuthProvider;
  slug: OAuthProviderSlug;
  icon: ReactNode;
  iconClassName: string;
}

function ProviderRow({ provider, slug, icon, iconClassName }: ProviderRowProps) {
  const { t } = useTranslation(['auth', 'common']);
  const { data: linkedAccounts } = useSuspenseQuery(useGetLinkedAccountsQueryOptions());
  const { mutate: link, isPending: isLinking } = useMutation(useLinkAccountMutationOptions());
  const { mutate: unlink, isPending: isUnlinking } = useMutation(useUnlinkAccountMutationOptions());
  const confirmDialog = useConfirmDialog();
  const isLinked = linkedAccounts.accounts.some(
    (account) => account.provider === provider && account.linked,
  );
  const isPending = isLinking || isUnlinking;

  const requestUnlink = async () => {
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
            {getOAuthProviderLabel(provider)}
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
          <Button
            size="small"
            variant="weak"
            onPress={requestUnlink}
            isDisabled={!linkedAccounts.canUnlink}
          >
            {t('linkedAccounts.unlink')}
          </Button>
        ))
        .with({ isPending: false, isLinked: false }, () => (
          <Button size="small" onPress={() => link(slug)}>
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
