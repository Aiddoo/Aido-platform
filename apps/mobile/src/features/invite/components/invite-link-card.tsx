import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useTranslation } from '@src/shared/i18n';
import {
  Button,
  CopyIcon,
  HStack,
  PauseIcon,
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

import { createInviteShareContent } from '../domains/invite-share.model';
import { InvitePolicy } from '../domains/invite.model';
import { useGetInviteQueryOptions } from '../queries/get-invite-query-options';
import { useRotateInviteCodeMutationOptions } from '../queries/use-rotate-invite-code-mutation-options';
import { useShareInviteMutationOptions } from '../queries/use-share-invite-mutation-options';

/** 내 초대 코드와 링크. 코드는 길게 눌러 고를 수 있고 복사 버튼으로 링크를 복사한다 */
export function InviteLinkCard({ className, ...props }: ComponentProps<typeof VStack>) {
  const { t } = useTranslation(['invite', 'common']);
  const [{ data: myInvite }, { data: me }] = useSuspenseQueries({
    queries: [useGetInviteQueryOptions(), useGetMeQueryOptions()],
  });
  const share = useMutation(useShareInviteMutationOptions());
  const rotate = useMutation(useRotateInviteCodeMutationOptions());
  const confirmDialog = useConfirmDialog();

  const handleRotatePress = async () => {
    const isConfirmed = await confirmDialog.open({
      title: t('myInvite.rotate.title'),
      description: t('myInvite.rotate.description'),
      cancelLabel: t('common:actions.cancel'),
      confirmLabel: t('myInvite.rotate.confirm'),
    });

    if (isConfirmed) {
      rotate.mutate();
    }
  };

  return (
    <InviteLinkCardFrame className={className} {...props}>
      <Text size="b4" weight="semibold" shade={6}>
        {t('myInvite.codeLabel')}
      </Text>

      <HStack align="center" justify="between" gap={12}>
        {/* 영어·큰 글자에서도 복사 버튼을 밀어내지 않게 줄이고, 그래도 넘치면 글자를 작게 맞춘다 */}
        <Text
          size="h1"
          weight="bold"
          maxLines={1}
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
            <CopyIcon width={16} height={16} colorClassName="text-main" />
            <Text size="b4" weight="semibold" tone="brand">
              {t('myInvite.copy')}
            </Text>
          </HStack>
        </Button>
      </HStack>

      <HStack align="center" justify="between" gap={8}>
        <Text size="b3" shade={7} maxLines={1} className="flex-1" selectable>
          {InvitePolicy.displayLink(myInvite)}
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
    </InviteLinkCardFrame>
  );
}

InviteLinkCard.Loading = function Loading() {
  return (
    <InviteLinkCardFrame accessibilityState={{ busy: true }}>
      <TextSkeleton size="b4" className="w-20" />
      <HStack align="center" justify="between">
        <TextSkeleton size="h1" className="w-44" />
        <Skeleton className="h-10 w-[72px] rounded-lg" />
      </HStack>
      <TextSkeleton size="b3" className="w-36" />
    </InviteLinkCardFrame>
  );
};

/** 초대가 꺼져 있다. 다시 시도해도 같으니 안내만 한다(사용 가능 여부는 초대 조회가 다시 받는다) */
InviteLinkCard.Unavailable = function Unavailable() {
  const { t } = useTranslation('invite');

  return (
    <InviteLinkCardFrame className="min-h-[136px] justify-center">
      <Result
        icon={<PauseIcon width={40} height={40} colorClassName="text-main" />}
        title={t('myInvite.unavailable.title')}
        description={t('myInvite.unavailable.description')}
      />
    </InviteLinkCardFrame>
  );
};

function InviteLinkCardFrame({ className, ...props }: ComponentProps<typeof VStack>) {
  return (
    <VStack
      gap={10}
      className={cn('rounded-[20px] border border-gray-2 bg-white px-[18px] py-4', className)}
      {...props}
    />
  );
}
