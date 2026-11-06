import { type Release, RELEASE_ID, releaseListSchema } from '../schemas/release.schema';
import { PREVIOUS_WHATS_NEW_CAMPAIGN_ID, WHATS_NEW_CAMPAIGN_ID } from './whats-new.constants';

export const RELEASE_1_15_0 = {
  id: RELEASE_ID.v1_15_0,
  campaignId: WHATS_NEW_CAMPAIGN_ID,
  releasedOn: '2026-11-05',
  summaryKey: 'v1_15_0.summary',
  requiresInvite: false,
} satisfies Release;

export const RELEASE_1_14_0 = {
  id: RELEASE_ID.v1_14_0,
  campaignId: PREVIOUS_WHATS_NEW_CAMPAIGN_ID,
  releasedOn: '2026-11-02',
  summaryKey: 'v1_14_0.summary',
  requiresInvite: true,
} satisfies Release;

export const RELEASES = releaseListSchema.parse([RELEASE_1_15_0, RELEASE_1_14_0]);
