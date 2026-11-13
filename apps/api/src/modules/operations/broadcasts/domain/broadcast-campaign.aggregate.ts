import {
  BROADCAST_CAMPAIGN_STATUS,
  type BroadcastCampaignStatus,
  type BroadcastTargetFilter,
  type SupportedLocale,
} from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { BroadcastAction, type BroadcastActionPrimitives } from "./broadcast-action.vo.js";
import { BroadcastCampaignId } from "./broadcast-campaign-id.vo.js";
import { BroadcastContent } from "./broadcast-content.vo.js";
import { BroadcastDelivery, type BroadcastDeliveryPrimitives } from "./broadcast-delivery.vo.js";
import {
  BroadcastLocalizedContent,
  type BroadcastLocalizedCopy,
} from "./broadcast-localized-content.vo.js";
import { broadcastCampaignFinished, broadcastNotDistributing } from "./broadcasts.errors.js";

/** 접수한 요청 내용 */
interface BroadcastCampaignRequest {
  readonly content: BroadcastContent;
  readonly localizedContent: BroadcastLocalizedContent;
  readonly targetFilter: BroadcastTargetFilter;
  readonly action: BroadcastAction | null;
  readonly force: boolean;
  readonly delivery: BroadcastDelivery;
}

export interface BroadcastCampaignPrimitives {
  readonly id: string;
  readonly requestId: string;
  readonly title: string;
  readonly body: string;
  readonly localizedContent: BroadcastLocalizedCopy | null;
  readonly targetFilter: BroadcastTargetFilter;
  readonly action: BroadcastActionPrimitives | null;
  readonly force: boolean;
  readonly delivery: BroadcastDeliveryPrimitives;
  readonly status: BroadcastCampaignStatus;
  readonly cursorUserId: string | null;
  readonly processedCount: number;
  readonly queuedCount: number;
  readonly failureReason: string | null;
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
  readonly startedAt: Temporal.Instant | null;
  readonly completedAt: Temporal.Instant | null;
}

interface BroadcastCampaignProps extends BroadcastCampaignRequest {
  readonly requestId: string;
  status: BroadcastCampaignStatus;
  cursorUserId: UserId | null;
  processedCount: number;
  queuedCount: number;
  failureReason: string | null;
  readonly createdAt: Temporal.Instant;
  updatedAt: Temporal.Instant;
  startedAt: Temporal.Instant | null;
  completedAt: Temporal.Instant | null;
}

interface CreateBroadcastCampaignParams extends BroadcastCampaignRequest {
  readonly id: BroadcastCampaignId;
  readonly requestId: string;
  readonly now: Temporal.Instant;
}

export interface BroadcastCampaignPage {
  readonly lastUserId: UserId;
  readonly processedCount: number;
  readonly queuedCount: number;
}

const TERMINAL_STATUSES: ReadonlySet<BroadcastCampaignStatus> = new Set([
  BROADCAST_CAMPAIGN_STATUS.COMPLETED,
  BROADCAST_CAMPAIGN_STATUS.FAILED,
]);

/** 관리자 브로드캐스트 한 건의 분배 진행. 페이지 cursor가 재시작 지점이고 같은 페이지를 두 번 세지 않는다. */
export class BroadcastCampaign extends AggregateRoot<BroadcastCampaignId, BroadcastCampaignProps> {
  static create(params: CreateBroadcastCampaignParams): BroadcastCampaign {
    return new BroadcastCampaign(params.id, {
      requestId: params.requestId,
      content: params.content,
      localizedContent: params.localizedContent,
      targetFilter: params.targetFilter,
      action: params.action,
      force: params.force,
      delivery: params.delivery,
      status: BROADCAST_CAMPAIGN_STATUS.QUEUED,
      cursorUserId: null,
      processedCount: 0,
      queuedCount: 0,
      failureReason: null,
      createdAt: params.now,
      updatedAt: params.now,
      startedAt: null,
      completedAt: null,
    });
  }

  static reconstitute(primitives: BroadcastCampaignPrimitives): BroadcastCampaign {
    return new BroadcastCampaign(BroadcastCampaignId.reconstitute(primitives.id), {
      requestId: primitives.requestId,
      content: BroadcastContent.reconstitute({ title: primitives.title, body: primitives.body }),
      localizedContent: BroadcastLocalizedContent.reconstitute(primitives.localizedContent),
      targetFilter: primitives.targetFilter,
      action: primitives.action == null ? null : BroadcastAction.reconstitute(primitives.action),
      force: primitives.force,
      delivery: BroadcastDelivery.reconstitute(primitives.delivery),
      status: primitives.status,
      cursorUserId:
        primitives.cursorUserId == null ? null : UserId.reconstitute(primitives.cursorUserId),
      processedCount: primitives.processedCount,
      queuedCount: primitives.queuedCount,
      failureReason: primitives.failureReason,
      createdAt: primitives.createdAt,
      updatedAt: primitives.updatedAt,
      startedAt: primitives.startedAt,
      completedAt: primitives.completedAt,
    });
  }

  get requestId(): string {
    return this.props.requestId;
  }

  /** 알림·발송 행을 캠페인에 묶는 키. 발송 결과 집계가 이 키로 찾는다. */
  get campaignKey(): string {
    return `admin-broadcast:${this.id.value}`;
  }

  get status(): BroadcastCampaignStatus {
    return this.props.status;
  }

  get cursorUserId(): UserId | null {
    return this.props.cursorUserId;
  }

  get processedCount(): number {
    return this.props.processedCount;
  }

  get queuedCount(): number {
    return this.props.queuedCount;
  }

  get title(): string {
    return this.props.content.title;
  }

  get targetFilter(): BroadcastTargetFilter {
    return this.props.targetFilter;
  }

  get action(): BroadcastAction | null {
    return this.props.action;
  }

  get force(): boolean {
    return this.props.force;
  }

  get delivery(): BroadcastDelivery {
    return this.props.delivery;
  }

  get createdAt(): Temporal.Instant {
    return this.props.createdAt;
  }

  get startedAt(): Temporal.Instant | null {
    return this.props.startedAt;
  }

  get completedAt(): Temporal.Instant | null {
    return this.props.completedAt;
  }

  get failureReason(): string | null {
    return this.props.failureReason;
  }

  /** 수신자 언어의 문구. 그 언어 문구가 없으면 캠페인 기본 title·body다. */
  contentFor(locale: SupportedLocale): BroadcastContent {
    return this.props.localizedContent.contentFor(locale) ?? this.props.content;
  }

  isTerminal(): boolean {
    return TERMINAL_STATUSES.has(this.props.status);
  }

  /** 같은 요청 ID의 재요청이 처음과 같은 내용인지 비교한다. 진행 상태는 비교하지 않는다. */
  isSameRequest(other: BroadcastCampaign): boolean {
    const { props } = other;
    return (
      this.props.content.equals(props.content) &&
      this.props.localizedContent.equals(props.localizedContent) &&
      this.props.targetFilter === props.targetFilter &&
      this.props.force === props.force &&
      this.props.delivery.equals(props.delivery) &&
      isSameAction(this.props.action, props.action)
    );
  }

  start(now: Temporal.Instant): boolean {
    if (this.props.status === BROADCAST_CAMPAIGN_STATUS.FANNING_OUT) {
      return false;
    }
    if (this.isTerminal()) {
      throw broadcastCampaignFinished(this.props.status);
    }
    this.props.status = BROADCAST_CAMPAIGN_STATUS.FANNING_OUT;
    this.props.startedAt = now;
    this.props.updatedAt = now;
    return true;
  }

  recordPage(page: BroadcastCampaignPage, now: Temporal.Instant): void {
    if (this.props.status !== BROADCAST_CAMPAIGN_STATUS.FANNING_OUT) {
      throw broadcastNotDistributing();
    }
    this.props.cursorUserId = page.lastUserId;
    this.props.processedCount += page.processedCount;
    this.props.queuedCount += page.queuedCount;
    this.props.updatedAt = now;
  }

  complete(now: Temporal.Instant): boolean {
    if (this.props.status === BROADCAST_CAMPAIGN_STATUS.COMPLETED) {
      return false;
    }
    if (this.isTerminal()) {
      throw broadcastCampaignFinished(this.props.status);
    }
    this.props.status = BROADCAST_CAMPAIGN_STATUS.COMPLETED;
    this.props.startedAt ??= now;
    this.props.completedAt = now;
    this.props.updatedAt = now;
    return true;
  }

  fail(reason: string, now: Temporal.Instant): boolean {
    if (this.props.status === BROADCAST_CAMPAIGN_STATUS.FAILED) {
      return false;
    }
    if (this.isTerminal()) {
      throw broadcastCampaignFinished(this.props.status);
    }
    this.props.status = BROADCAST_CAMPAIGN_STATUS.FAILED;
    this.props.failureReason = reason;
    this.props.completedAt = now;
    this.props.updatedAt = now;
    return true;
  }

  toPrimitives(): BroadcastCampaignPrimitives {
    const { localizedContent } = this.props;
    return {
      id: this.id.value,
      requestId: this.props.requestId,
      title: this.props.content.title,
      body: this.props.content.body,
      localizedContent: localizedContent.isEmpty ? null : localizedContent.value,
      targetFilter: this.props.targetFilter,
      action: this.props.action?.toPrimitives() ?? null,
      force: this.props.force,
      delivery: this.props.delivery.toPrimitives(),
      status: this.props.status,
      cursorUserId: this.props.cursorUserId?.value ?? null,
      processedCount: this.props.processedCount,
      queuedCount: this.props.queuedCount,
      failureReason: this.props.failureReason,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
      startedAt: this.props.startedAt,
      completedAt: this.props.completedAt,
    };
  }
}

function isSameAction(left: BroadcastAction | null, right: BroadcastAction | null): boolean {
  if (left == null || right == null) {
    return left === right;
  }
  return left.equals(right);
}
