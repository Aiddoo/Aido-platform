import catHiImage from '@assets/images/ido_cat_hi.webp';
import type { FeatureDiscoveryCardId } from '@src/features/feature-discovery/domains/feature-discovery.registry';
import { Box, HStack, PawIcon } from '@src/shared/ui';
import { Image } from 'react-native';
import { match } from 'ts-pattern';

export function FeatureDiscoveryPreview({ cardId }: { cardId: FeatureDiscoveryCardId }) {
  return match(cardId)
    .with('friend_invite', () => <FriendInvitePreview />)
    .exhaustive();
}

/** 찍힌 발자국과 기다리는 발자국, 인사하는 고양이 */
function FriendInvitePreview() {
  return (
    <Box
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="h-[150px] justify-center overflow-hidden rounded-[20px] bg-highlight px-[18px]"
    >
      <HStack align="center" gap={10}>
        <Box className="size-11 -rotate-6 items-center justify-center rounded-full bg-main">
          <PawIcon width={22} height={22} colorClassName="text-white dark:text-gray-1" />
        </Box>
        <Box className="h-0.5 w-7 bg-main/50" />
        <Box className="size-11 items-center justify-center rounded-full border-[1.5px] border-dashed border-main bg-main/10">
          <PawIcon width={22} height={22} colorClassName="text-main opacity-40" />
        </Box>
      </HStack>
      <Image
        source={catHiImage}
        accessibilityIgnoresInvertColors
        className="absolute -bottom-6 -right-2.5 size-[140px]"
        resizeMode="contain"
      />
    </Box>
  );
}
