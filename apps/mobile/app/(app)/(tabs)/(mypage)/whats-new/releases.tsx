import { ReleaseRow } from '@src/features/app-config/whats-new/components/release-row';
import {
  RELEASE_1_14_0,
  RELEASE_1_15_0,
} from '@src/features/app-config/whats-new/constants/releases';
import { WhatsNewPolicy } from '@src/features/app-config/whats-new/domains/whats-new.model';
import { useIsInviteAvailable } from '@src/features/social/invite/hooks/use-is-invite-available';
import { ReadableContent, StyledSafeAreaView, VStack } from '@src/shared/ui';
import { ScrollView } from 'react-native';

export default function WhatsNewReleasesRoute() {
  const isInviteAvailable = useIsInviteAvailable();

  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1">
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <ReadableContent px={16} pt={8} pb={24}>
          <VStack gap={10}>
            <ReleaseRow release={RELEASE_1_15_0} />

            {WhatsNewPolicy.canViewRelease(RELEASE_1_14_0, { isInviteAvailable }) && (
              <ReleaseRow release={RELEASE_1_14_0} />
            )}
          </VStack>
        </ReadableContent>
      </ScrollView>
    </StyledSafeAreaView>
  );
}
