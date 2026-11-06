import { ReleaseCard } from '@src/features/app-config/whats-new/components/release-card';
import {
  RELEASE_1_14_0,
  RELEASE_1_15_0,
} from '@src/features/app-config/whats-new/constants/releases';
import { WhatsNewPolicy } from '@src/features/app-config/whats-new/domains/whats-new.model';
import { useInviteAvailability } from '@src/features/social/invite/hooks/use-invite-availability';
import { ReadableContent, StyledSafeAreaView, VStack } from '@src/shared/ui';
import { ScrollView } from 'react-native';

export default function WhatsNewReleasesRoute() {
  const isInviteAvailable = useInviteAvailability();

  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1">
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <ReadableContent px={16} pt={8} pb={24}>
          <VStack gap={10}>
            <ReleaseCard release={RELEASE_1_15_0} />

            {WhatsNewPolicy.isReleaseAvailable(RELEASE_1_14_0, { isInviteAvailable }) && (
              <ReleaseCard release={RELEASE_1_14_0} />
            )}
          </VStack>
        </ReadableContent>
      </ScrollView>
    </StyledSafeAreaView>
  );
}
