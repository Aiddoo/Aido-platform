import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  CheckIcon,
  CopyIcon,
  Grid,
  GridItem,
  HStack,
  KakaoIcon,
  type QueryErrorFallbackProps,
  ShareIcon,
  Text,
  TextButton,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useSuspenseQueries } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import type { ComponentProps, ReactNode } from 'react';

import { createInviteShareContent, type InviteShareChannel } from '../domains/invite-share.model';
import { useCopiedFeedback } from '../hooks/use-copied-feedback';
import { useGetInviteQueryOptions } from '../queries/get-invite-query-options';
import { useShareInviteMutationOptions } from '../queries/use-share-invite-mutation-options';

/** 카카오톡 / 링크 복사 / 다른 앱 공유 */
export function InviteShareActions(props: ComponentProps<typeof VStack>) {
  const [{ data: myInvite }, { data: me }] = useSuspenseQueries({
    queries: [useGetInviteQueryOptions(), useGetMeQueryOptions()],
  });
  const share = useMutation(useShareInviteMutationOptions());
  const [isCopied, showCopied] = useCopiedFeedback();

  const handleShare = (channel: InviteShareChannel) =>
    share.mutate(
      { channel, content: createInviteShareContent(myInvite, me.name) },
      {
        onSuccess: ({ outcome }) => {
          if (outcome === 'copied') {
            showCopied();
          }
        },
      },
    );

  return (
    <InviteShareButtons
      isDisabled={share.isPending}
      isCopied={isCopied}
      onShare={handleShare}
      {...props}
    />
  );
}

/** 요약을 불러오는 동안 같은 자리에 비활성 버튼을 둔다 */
InviteShareActions.Loading = function Loading() {
  return <InviteShareButtons isDisabled isCopied={false} onShare={noop} />;
};

/** 버튼 자리를 그대로 두고 다시 불러오기만 받는다 */
InviteShareActions.Error = function ErrorState({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('invite');

  return (
    <VStack gap={10}>
      <InviteShareButtons isDisabled isCopied={false} onShare={noop} />
      <Box className="items-center">
        <TextButton size="small" onPress={reset}>
          {t('result.retry')}
        </TextButton>
      </Box>
    </VStack>
  );
};

interface InviteShareButtonsProps extends ComponentProps<typeof VStack> {
  isDisabled: boolean;
  isCopied: boolean;
  onShare: (channel: InviteShareChannel) => void;
}

function InviteShareButtons({
  isDisabled,
  isCopied,
  onShare,
  className,
  ...props
}: InviteShareButtonsProps) {
  const { t } = useTranslation('invite');

  return (
    <VStack gap={10} className={className} {...props}>
      <Button
        testID="invite-share-kakao"
        className="h-[54px] bg-kakao"
        isDisabled={isDisabled}
        onPress={() => onShare('kakao')}
      >
        <HStack align="center" gap={8}>
          <KakaoIcon width={20} height={20} />
          <Text size="b2" weight="bold" shade={9} className="dark:text-gray-1">
            {t('share.kakao')}
          </Text>
        </HStack>
      </Button>

      <Grid columns={2} columnGap={10}>
        <GridItem>
          <InviteSecondaryShareButton
            icon={
              isCopied ? (
                <CheckIcon width={18} height={18} colorClassName="text-main" />
              ) : (
                <CopyIcon width={18} height={18} colorClassName="text-gray-8" />
              )
            }
            testID="invite-share-copy-link"
            label={t('share.copyLink')}
            isDisabled={isDisabled}
            onPress={() => onShare('copy_link')}
          />
        </GridItem>
        <GridItem>
          <InviteSecondaryShareButton
            icon={<ShareIcon width={18} height={18} colorClassName="text-gray-8" />}
            testID="invite-share-system"
            label={t('share.system')}
            isDisabled={isDisabled}
            onPress={() => onShare('system')}
          />
        </GridItem>
      </Grid>
    </VStack>
  );
}

interface InviteSecondaryShareButtonProps extends Omit<
  ComponentProps<typeof Button>,
  'children' | 'variant' | 'color'
> {
  icon: ReactNode;
  label: string;
}

function InviteSecondaryShareButton({
  icon,
  label,
  className,
  ...props
}: InviteSecondaryShareButtonProps) {
  return (
    <Button variant="weak" color="dark" className={cn('h-[50px] bg-gray-2', className)} {...props}>
      <HStack align="center" gap={6}>
        {icon}
        <Text size="b3" weight="semibold" shade={9}>
          {label}
        </Text>
      </HStack>
    </Button>
  );
}
