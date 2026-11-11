import { BroadcastCampaignRepositoryPort } from "#api/modules/operations/broadcasts/application/ports/broadcast-campaign.repository.port";
import { BroadcastCampaignId } from "#api/modules/operations/broadcasts/domain/broadcast-campaign-id.vo";
import { BroadcastCampaign } from "#api/modules/operations/broadcasts/domain/broadcast-campaign.aggregate";

// 저장 사본을 두어 save 없이 바꾼 Aggregate가 저장소 상태로 새지 않게 한다
function copyOf(campaign: BroadcastCampaign): BroadcastCampaign {
  return BroadcastCampaign.reconstitute(campaign.toPrimitives());
}

export class InMemoryBroadcastCampaignRepository extends BroadcastCampaignRepositoryPort {
  readonly #campaigns = new Map<string, BroadcastCampaign>();
  #sequence = 0;

  constructor(campaigns: readonly BroadcastCampaign[] = []) {
    super();
    for (const campaign of campaigns) {
      this.#campaigns.set(campaign.id.value, copyOf(campaign));
    }
  }

  get size(): number {
    return this.#campaigns.size;
  }

  async nextId(): Promise<BroadcastCampaignId> {
    this.#sequence += 1;
    return BroadcastCampaignId.reconstitute(`c-new-${this.#sequence}`);
  }

  async acceptByRequestId(
    campaign: BroadcastCampaign,
  ): Promise<{ readonly campaign: BroadcastCampaign; readonly created: boolean }> {
    const existing = [...this.#campaigns.values()].find(
      (stored) => stored.requestId === campaign.requestId,
    );
    if (existing != null) {
      return { campaign: copyOf(existing), created: false };
    }
    this.#campaigns.set(campaign.id.value, copyOf(campaign));
    return { campaign: copyOf(campaign), created: true };
  }

  async findById(campaignId: BroadcastCampaignId): Promise<BroadcastCampaign | null> {
    const campaign = this.#campaigns.get(campaignId.value);
    return campaign == null ? null : copyOf(campaign);
  }

  async findByIdForUpdate(campaignId: BroadcastCampaignId): Promise<BroadcastCampaign | null> {
    return this.findById(campaignId);
  }

  async save(campaign: BroadcastCampaign): Promise<void> {
    this.#campaigns.set(campaign.id.value, copyOf(campaign));
  }
}
