import { useTranslation } from '@src/shared/i18n';
import {
  AppleIcon,
  Box,
  Button,
  GoogleIcon,
  HStack,
  IconCircle,
  KakaoIcon,
  ListRow,
  NaverIcon,
  SettingsListGroup,
  Text,
  TextSkeleton,
  useConfirmDialog,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Chip, Skeleton, Spinner } from 'heroui-native';
import type { ReactNode } from 'react';
import { match } from 'ts-pattern';

import { getOAuthProviderLabel } from '../constants/oauth-labels';
import { type OAuthProvider } from '../domains/oauth.model';
import { OAuthPolicy } from '../domains/oauth.model';
import {
  useLinkAccountMutationOptions,
  useUnlinkAccountMutationOptions,
} from '../queries/auth.mutations';
import { useGetLinkedAccountsQueryOptions } from '../queries/auth.queries';

export function LinkedAccountList() {
  return (
    <SettingsListGroup>
      <ProviderRow
        provider="KAKAO"
        icon={<KakaoIcon width={18} height={18} />}
        iconClassName="bg-yellow-300"
      />

      <SettingsListGroup.Separator />

      <ProviderRow
        provider="GOOGLE"
        icon={<GoogleIcon width={18} height={18} />}
        iconClassName="bg-white border border-gray-2"
      />

      {process.env.EXPO_OS === 'ios' && (
        <>
          <SettingsListGroup.Separator />

          <ProviderRow
            provider="APPLE"
            icon={<AppleIcon width={18} height={18} colorClassName="text-white dark:text-black" />}
            iconClassName="bg-apple-button dark:bg-apple-button-dark"
          />
        </>
      )}

      <SettingsListGroup.Separator />

      <ProviderRow
        provider="NAVER"
        icon={<NaverIcon width={18} height={18} colorClassName="text-white" />}
        iconClassName="bg-success"
      />
    </SettingsListGroup>
  );
}

LinkedAccountList.Loading = function Loading() {
  return (
    <SettingsListGroup>
      <ProviderRow.Loading />

      <SettingsListGroup.Separator />

      <ProviderRow.Loading />

      {process.env.EXPO_OS === 'ios' && (
        <>
          <SettingsListGroup.Separator />

          <ProviderRow.Loading />
        </>
      )}

      <SettingsListGroup.Separator />

      <ProviderRow.Loading />
    </SettingsListGroup>
  );
};

LinkedAccountList.Error = SettingsListGroup.Error;

interface ProviderRowProps {
  provider: OAuthProvider;
  icon: ReactNode;
  iconClassName: string;
}

function ProviderRow({ provider, icon, iconClassName }: ProviderRowProps) {
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
    const isConfirmed = await confirmDialog.openAsync({
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
      left={<IconCircle tone="plain" icon={icon} className={cn('size-10', iconClassName)} />}
      contents={
        <VStack gap={2}>
          <Text size="b3" weight="medium">
            {getOAuthProviderLabel(provider)}
          </Text>
          <Chip
            size="sm"
            variant="soft"
            color={isLinked ? 'accent' : 'default'}
            pointerEvents="none"
            className="mt-0.5 self-start"
          >
            <Text
              size="e2"
              weight="medium"
              className={cn(
                isLinked ? 'text-accent-soft-foreground' : 'text-default-soft-foreground',
              )}
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
            display="inline"
            variant="weak"
            onPress={requestUnlink}
            isDisabled={!linkedAccounts.canUnlink}
          >
            {t('linkedAccounts.unlink')}
          </Button>
        ))
        .with({ isPending: false, isLinked: false }, () => (
          <Button
            size="small"
            display="inline"
            onPress={() => link(OAuthPolicy.toOAuthProviderSlug(provider))}
          >
            {t('linkedAccounts.connect')}
          </Button>
        ))
        .exhaustive()}
    />
  );
}

ProviderRow.Loading = function Loading() {
  return (
    <HStack align="center" gap={12} className="px-4 py-4">
      <Skeleton className="size-10 rounded-full dark:bg-gray-2" />
      <VStack flex={1} gap={2}>
        <TextSkeleton size="b3" className="w-16" />
        <TextSkeleton size="e2" className="w-12" />
      </VStack>
      <Skeleton className="h-8 w-16 rounded-lg dark:bg-gray-2" />
    </HStack>
  );
};
