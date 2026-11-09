import {
  PREVIOUS_WHATS_NEW_CAMPAIGN_ID,
  WHATS_NEW_CAMPAIGN_ID,
} from '@src/features/app-config/feature-campaign/constants/feature-campaign.constants';

import { type ReleaseEntry, releaseEntryListSchema } from '../schemas/release-entry.schema';
import { RELEASE_ID } from './whats-new.constants';

export const RELEASE_1_15_0 = {
  id: RELEASE_ID.v1_15_0,
  campaignId: WHATS_NEW_CAMPAIGN_ID,
  releasedOn: '2026-11-05',
  titleKey: 'v1_15_0.release.title',
  descriptionKey: 'v1_15_0.release.description',
  requiresInvite: false,
} satisfies ReleaseEntry;

export const RELEASE_1_14_0 = {
  id: RELEASE_ID.v1_14_0,
  campaignId: PREVIOUS_WHATS_NEW_CAMPAIGN_ID,
  releasedOn: '2026-11-02',
  titleKey: 'v1_14_0.release.title',
  descriptionKey: 'v1_14_0.release.description',
  requiresInvite: true,
} satisfies ReleaseEntry;

export const RELEASES = releaseEntryListSchema.parse([RELEASE_1_15_0, RELEASE_1_14_0]);
