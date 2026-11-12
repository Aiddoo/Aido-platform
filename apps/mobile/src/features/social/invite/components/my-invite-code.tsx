import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import {
  Button,
  CopyIcon,
  FriendIllustration,
  HStack,
  Result,
  Text,
  TextButton,
  TextSkeleton,
  useConfirmDialog,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useSuspenseQueries } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';
import type { ComponentProps } from 'react';

import { useCreateInviteShareContent } from '../hooks/use-create-invite-share-content';
import {
  useRotateInviteCodeMutationOptions,
  useShareInviteMutationOptions,
} from '../queries/invite.mutations';
import { useGetInviteQueryOptions } from '../queries/invite.queries';

/** 내 초대 코드와 링크. 코드는 길게 눌러 고를 수 있고 복사 버튼으로 링크를 복사한다 */
export function MyInviteCode() {
  const { t } = useTranslation(['invite', 'common']);
  const fontScaledSize = useFontScaledSize();
  const createInviteShareContent = useCreateInviteShareContent();
  const [{ data: myInvite }, { data: me }] = useSuspenseQueries({
    queries: [useGetInviteQueryOptions(), useGetMeQueryOptions()],
  });
  const share = useMutation(useShareInviteMutationOptions());
  const rotate = useMutation(useRotateInviteCodeMutationOptions());
  const confirmDialog = useConfirmDialog();

  const handleRotatePress = async () => {
    await confirmDialog.openAsync({
      title: t('myInvite.rotate.title'),
      description: t('myInvite.rotate.description'),
      cancelLabel: t('common:actions.cancel'),
      confirmLabel: t('myInvite.rotate.confirm'),
      onConfirm: () => rotate.mutateAsync(),
    });
  };

  return (
    <MyInviteCodeSurface>
      <Text size="b4" weight="semibold" shade={6}>
        {t('myInvite.codeLabel')}
      </Text>

      <HStack align="center" justify="between" gap={12}>
        {/* 영어·큰 글자에서도 복사 버튼을 밀어내지 않게 줄이고, 그래도 넘치면 글자를 작게 맞춘다 */}
        <Text
          size="h1"
          weight="bold"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          className="shrink tracking-[6px] tabular-nums"
          selectable
          testID="my-invite-code"
        >
          {myInvite.code}
        </Text>

        <Button
          className="shrink-0"
          size="medium"
          variant="weak"
          display="inline"
          radius="md"
          accessibilityLabel={t('myInvite.copyLink')}
          isDisabled={share.isPending}
          onPress={() =>
            share.mutate({
              channel: 'copy_link',
              content: createInviteShareContent(myInvite, me.name),
            })
          }
        >
          <HStack align="center" gap={6}>
            <CopyIcon
              width={fontScaledSize(16)}
              height={fontScaledSize(16)}
              colorClassName="text-main"
            />
            <Text size="b4" weight="semibold" tone="brand">
              {t('myInvite.copy')}
            </Text>
          </HStack>
        </Button>
      </HStack>

      <HStack align="center" justify="between" gap={8}>
        <Text size="b3" shade={7} numberOfLines={1} className="flex-1" selectable>
          {myInvite.link.replace(/^https?:\/\//, '')}
        </Text>

        <TextButton
          testID="my-invite-rotate"
          size="small"
          onPress={handleRotatePress}
          isDisabled={rotate.isPending}
        >
          {t('myInvite.rotate.button')}
        </TextButton>
      </HStack>
    </MyInviteCodeSurface>
  );
}

MyInviteCode.Loading = function Loading() {
  return (
    <MyInviteCodeSurface accessibilityState={{ busy: true }}>
      <TextSkeleton size="b4" className="w-20" />
      <HStack align="center" justify="between">
        <TextSkeleton size="h1" className="w-44" />
        <Skeleton className="h-10 w-[72px] rounded-lg dark:bg-gray-2" />
      </HStack>
      <TextSkeleton size="b3" className="w-36" />
    </MyInviteCodeSurface>
  );
};

/** 초대가 꺼져 있다. 다시 시도해도 같으니 안내만 한다(사용 가능 여부는 초대 조회가 다시 받는다) */
MyInviteCode.Unavailable = function Unavailable() {
  const { t } = useTranslation('invite');

  return (
    <MyInviteCodeSurface className="min-h-[136px] justify-center">
      <Result
        icon={<FriendIllustration size="block" />}
        title={t('myInvite.unavailable.title')}
        description={t('myInvite.unavailable.description')}
      />
    </MyInviteCodeSurface>
  );
};

function MyInviteCodeSurface({ className, ...props }: ComponentProps<typeof VStack>) {
  return (
    <VStack
      gap={10}
      className={cn('rounded-[20px] border border-gray-2 bg-gray-1 px-4.5 py-4', className)}
      {...props}
    />
  );
}
