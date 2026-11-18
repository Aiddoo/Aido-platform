import type { BroadcastActionPrimitives } from "../../domain/broadcast-action.vo.js";
import type { AdminBroadcastType } from "../../domain/broadcast-campaigns.constants.js";

export interface BroadcastMessageReadModel {
  readonly userId: string;
  readonly type: AdminBroadcastType;
  readonly title: string;
  readonly body: string;
  readonly action?: BroadcastActionPrimitives;
  readonly metadata?: { readonly externalUrl: string };
  readonly force: boolean;
  readonly campaignKey?: string;
}
