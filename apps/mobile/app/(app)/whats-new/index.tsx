import { Release1140Steps } from '@src/features/app-config/whats-new/components/release-1-14-0-steps';
import { Release1150Steps } from '@src/features/app-config/whats-new/components/release-1-15-0-steps';
import { useWhatsNewParams } from '@src/features/app-config/whats-new/hooks/use-whats-new-params';
import { RELEASE_ID } from '@src/features/app-config/whats-new/schemas/release.schema';
import { useInviteAvailability } from '@src/features/social/invite/hooks/use-invite-availability';
import { ReadableContent, StyledSafeAreaView } from '@src/shared/ui';
import { match } from 'ts-pattern';

export default function WhatsNewRoute() {
  const [{ releaseId, source }] = useWhatsNewParams();
  const isInviteAvailable = useInviteAvailability();

  return (
    <StyledSafeAreaView className="flex-1 bg-white">
      <ReadableContent flex={1} px={20} pb={16}>
        {match(releaseId)
          .with(RELEASE_ID.v1_15_0, () => <Release1150Steps source={source} />)
          .with(RELEASE_ID.v1_14_0, () => (
            <Release1140Steps source={source} isInviteAvailable={isInviteAvailable} />
          ))
          .exhaustive()}
      </ReadableContent>
    </StyledSafeAreaView>
  );
}
