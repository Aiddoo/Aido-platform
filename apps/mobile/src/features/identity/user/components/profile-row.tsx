import { useCopyToClipboard } from '@src/shared/hooks/use-copy-to-clipboard';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowRightIcon,
  CopyIcon,
  H4,
  HStack,
  IconButton,
  Text,
  TextSkeleton,
  VStack,
  SettingsListGroup,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQuery } from '@tanstack/react-query';
import { PressableFeedback, Skeleton } from 'heroui-native';
import type { ReactNode } from 'react';

import { USER_LOG_EVENT } from '../constants/user-log-events';
import {
  useIsMyPageMenuItemSelected,
  useMyPageMenuNavigate,
} from '../hooks/use-my-page-menu-navigation';
import { useGetMeQueryOptions } from '../queries/user.queries';
import { formatUserHashtag } from '../utils/user-tag.view-model';
import { UserAvatar } from './user-avatar';

interface ProfileRowProps {
  /** 구독 기능을 모르도록 route가 조립해 넘긴다. 같은 경계 안이라 함께 로딩하고 함께 실패한다 */
  tierChip: ReactNode;
}

export function ProfileRow({ tierChip }: ProfileRowProps) {
  const fontScaledSize = useFontScaledSize();
  const navigate = useMyPageMenuNavigate();
  const isSelected = useIsMyPageMenuItemSelected('/settings/profile');
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const { t } = useTranslation('user');
  const { copy } = useCopyToClipboard();

  const handleCopyUserTag = () =>
    copy(user.userTag, {
      successMessage: t('profile.tagCopied'),
      successDescription: t('profile.tagCopiedDescription'),
      failureMessage: t('profile.tagCopyFailed'),
      failureLogEvent: USER_LOG_EVENT.TAG_COPY_FAILED,
    });

  return (
    <PressableFeedback
      accessibilityRole="button"
      onPress={() => navigate('/settings/profile')}
      className={cn('rounded-2xl px-4 py-3', isSelected && 'bg-gray-2')}
    >
      <HStack gap={12} align="center">
        <UserAvatar
          size="lg"
          alt={t('profile.avatarAlt', { name: user.name })}
          profileImage={user.profileImage}
        />

        <VStack className="flex-1">
          <HStack align="center" gap={6}>
            <H4 numberOfLines={1} className="shrink">
              {user.name}
            </H4>
            {tierChip}
          </HStack>

          <HStack align="center" gap={2}>
            <Text size="b4" shade={6}>
              {formatUserHashtag(user.userTag)}
            </Text>
            <IconButton
              accessibilityLabel={t('profile.copyTag')}
              icon={
                <CopyIcon
                  width={fontScaledSize(12)}
                  height={fontScaledSize(12)}
                  colorClassName="text-gray-5"
                />
              }
              className="min-h-0 min-w-0 p-1"
              hitSlop={8}
              onPress={(event) => {
                event.stopPropagation();
                handleCopyUserTag();
              }}
            />
          </HStack>
        </VStack>

        <ArrowRightIcon colorClassName="text-gray-6" />
      </HStack>
      <PressableFeedback.Highlight className="rounded-2xl" />
    </PressableFeedback>
  );
}

ProfileRow.Loading = function Loading() {
  return (
    <HStack gap={12} align="center" className="rounded-2xl px-4 py-3">
      <Skeleton className="size-12 rounded-full" />
      <VStack className="flex-1">
        <TextSkeleton size="t3" className="w-24" />
        <TextSkeleton size="b4" className="w-20" />
      </VStack>
    </HStack>
  );
};

ProfileRow.Error = SettingsListGroup.Error;
