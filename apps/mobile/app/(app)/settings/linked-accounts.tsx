import type { OAuthProvider } from '@src/features/auth/models/oauth.model';
import { PROVIDER_CONFIGS } from '@src/features/auth/presentations/constants/provider-configs.constant';
import { useLinkedAccounts } from '@src/features/auth/presentations/hooks/use-linked-accounts';
import { Button } from '@src/shared/ui/Button';
import { ConfirmDialog } from '@src/shared/ui/ConfirmDialog';
import { HStack } from '@src/shared/ui/HStack';
import { ListRow } from '@src/shared/ui/ListRow';
import { QueryErrorBoundary } from '@src/shared/ui/QueryErrorBoundary';
import { StyledSafeAreaView } from '@src/shared/ui/SafeAreaView/SafeAreaView';
import { Spacing } from '@src/shared/ui/Spacing';
import { Text } from '@src/shared/ui/Text';
import { VStack } from '@src/shared/ui/VStack';
import { cn } from '@src/shared/utils/cn';
import times from 'es-toolkit/compat/times';
import { Chip, Separator, Skeleton, SkeletonGroup, Spinner } from 'heroui-native';
import type { ReactNode } from 'react';
import { Fragment, memo, Suspense, useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';

const LinkedAccountsScreen = () => {
  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <ScrollView className="px-4 flex-1">
        <Spacing size={20} />

        <Text size="b4" shade={6} className="px-2 pb-2">
          소셜 계정을 연결하면 다양한 방법으로 로그인할 수 있습니다
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

function LinkedAccountsList() {
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
        {PROVIDER_CONFIGS.map((config, index) => {
          const { isLinked, isPending } = getProviderState(config.provider, config.slug);

          return (
            <Fragment key={config.provider}>
              {index > 0 && <Separator className="mx-4 bg-gray-2" />}
              <ProviderListRow
                provider={config.provider}
                slug={config.slug}
                icon={config.icon}
                iconClassName={config.iconClassName}
                label={config.label}
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
        title={<ConfirmDialog.Title>계정 연결 해제</ConfirmDialog.Title>}
        description={
          <ConfirmDialog.Description>
            {unlinkTarget?.label} 계정 연결을 해제하시겠습니까?{'\n'}해제 후 해당 계정으로 로그인할
            수 없습니다.
          </ConfirmDialog.Description>
        }
        cancelButton={
          <ConfirmDialog.CancelButton onPress={() => setUnlinkTarget(null)}>
            취소
          </ConfirmDialog.CancelButton>
        }
        confirmButton={
          <ConfirmDialog.ConfirmButton onPress={handleUnlinkConfirm}>
            해제
          </ConfirmDialog.ConfirmButton>
        }
      />
    </>
  );
}

LinkedAccountsList.Loading = function Loading() {
  return (
    <>
      <View className="px-2 pb-2">
        <SkeletonGroup isLoading isSkeletonOnly>
          <Skeleton className="h-4 w-64 rounded" />
        </SkeletonGroup>
      </View>
      <VStack className="bg-white rounded-2xl overflow-hidden border border-gray-2">
        <SkeletonGroup isLoading isSkeletonOnly>
          {times(4, (index) => (
            <Fragment key={`linked-account-skeleton-${index}`}>
              <SkeletonRow />
              {index < 3 && <Separator className="mx-4 bg-gray-2" />}
            </Fragment>
          ))}
        </SkeletonGroup>
      </VStack>
    </>
  );
};

function SkeletonRow() {
  return (
    <HStack align="center" gap={12} className="px-4 py-3.5">
      <Skeleton className="w-9 h-9 rounded-full" />
      <VStack flex={1} gap={2}>
        <Skeleton className="h-4 w-16 rounded" />
        <Skeleton className="h-3 w-12 rounded" />
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
            <Chip.Label className="text-e2">{isLinked ? '연결됨' : '연결 안 됨'}</Chip.Label>
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
            해제
          </Button>
        ) : (
          <Button size="small" onPress={handleLinkPress}>
            연결
          </Button>
        )
      }
    />
  );
});
