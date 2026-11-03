import type { NotificationAction } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import {
  BROADCAST_CAMPAIGN_STATUS,
  type BroadcastCampaignStatus,
  type BroadcastTargetFilter,
} from "@aido/api/vocabulary";

import { AggregateRoot, DomainException } from "#api/shared/domain/index";

import type { BroadcastContent } from "../../value-objects/admin/broadcast-content.vo.js";

export interface BroadcastCampaignRequest {
  readonly title: string;
  readonly body: string;
  readonly targetFilter: BroadcastTargetFilter;
  readonly action: NotificationAction | null;
  readonly force: boolean;
}

export interface BroadcastCampaignProps extends BroadcastCampaignRequest {
  readonly id: string;
  readonly requestId: string;
  status: BroadcastCampaignStatus;
  cursorUserId: string | null;
  processedCount: number;
  queuedCount: number;
  failureReason: string | null;
  readonly createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface BroadcastCampaignCreationPlan extends BroadcastCampaignRequest {
  readonly requestId: string;
  readonly createdAt: Date;
}

export interface BroadcastCampaignPage {
  readonly lastUserId: string;
  readonly processedCount: number;
  readonly queuedCount: number;
}

/** 알림·발송 행을 캠페인에 묶는 키. 발송 결과 집계가 이 키로 찾는다. */
export function broadcastCampaignKey(campaignId: string): string {
  return `admin-broadcast:${campaignId}`;
}

const TERMINAL_STATUSES: ReadonlySet<BroadcastCampaignStatus> = new Set([
  BROADCAST_CAMPAIGN_STATUS.COMPLETED,
  BROADCAST_CAMPAIGN_STATUS.FAILED,
]);

/** 관리자 브로드캐스트 한 건의 분배 진행. 페이지 cursor가 재시작 지점이고 같은 페이지를 두 번 세지 않는다. */
export class BroadcastCampaign extends AggregateRoot<BroadcastCampaignProps> {
  private constructor(props: BroadcastCampaignProps) {
    super(props);
  }

  static planCreation(input: {
    readonly requestId: string;
    readonly content: BroadcastContent;
    readonly targetFilter: BroadcastTargetFilter;
    readonly action: NotificationAction | undefined;
    readonly force: boolean;
    readonly createdAt: Date;
  }): BroadcastCampaignCreationPlan {
    return {
      requestId: input.requestId,
      title: input.content.title,
      body: input.content.body,
      targetFilter: input.targetFilter,
      action: input.action == null ? null : { ...input.action },
      force: input.force,
      createdAt: new Date(input.createdAt),
    };
  }

  static reconstitute(props: BroadcastCampaignProps): BroadcastCampaign {
    return new BroadcastCampaign({
      ...props,
      action: props.action == null ? null : { ...props.action },
      createdAt: new Date(props.createdAt),
      startedAt: props.startedAt == null ? null : new Date(props.startedAt),
      completedAt: props.completedAt == null ? null : new Date(props.completedAt),
    });
  }

  get id(): string {
    return this.props.id;
  }

  get campaignKey(): string {
    return broadcastCampaignKey(this.props.id);
  }

  get requestId(): string {
    return this.props.requestId;
  }

  get status(): BroadcastCampaignStatus {
    return this.props.status;
  }

  get cursorUserId(): string | null {
    return this.props.cursorUserId;
  }

  get processedCount(): number {
    return this.props.processedCount;
  }

  get queuedCount(): number {
    return this.props.queuedCount;
  }

  get title(): string {
    return this.props.title;
  }

  get body(): string {
    return this.props.body;
  }

  get targetFilter(): BroadcastTargetFilter {
    return this.props.targetFilter;
  }

  get action(): NotificationAction | null {
    return this.props.action == null ? null : { ...this.props.action };
  }

  get force(): boolean {
    return this.props.force;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  isTerminal(): boolean {
    return TERMINAL_STATUSES.has(this.props.status);
  }

  /** 같은 요청 ID의 재요청이 처음과 같은 내용인지 확인한다. */
  isSameRequest(request: BroadcastCampaignRequest): boolean {
    return (
      this.props.title === request.title &&
      this.props.body === request.body &&
      this.props.targetFilter === request.targetFilter &&
      this.props.force === request.force &&
      this.props.action?.type === request.action?.type &&
      this.props.action?.url === request.action?.url
    );
  }

  start(now: Date): boolean {
    if (this.props.status !== BROADCAST_CAMPAIGN_STATUS.QUEUED) {
      return false;
    }
    this.props.status = BROADCAST_CAMPAIGN_STATUS.FANNING_OUT;
    this.props.startedAt = new Date(now);
    return true;
  }

  recordPage(page: BroadcastCampaignPage): void {
    if (this.props.status !== BROADCAST_CAMPAIGN_STATUS.FANNING_OUT) {
      throw new DomainException(ErrorCode.SYS_0002, {
        reason: "분배 중인 캠페인만 페이지를 기록할 수 있습니다",
      });
    }
    this.props.cursorUserId = page.lastUserId;
    this.props.processedCount += page.processedCount;
    this.props.queuedCount += page.queuedCount;
  }

  complete(now: Date): boolean {
    if (this.isTerminal()) {
      return false;
    }
    this.props.status = BROADCAST_CAMPAIGN_STATUS.COMPLETED;
    this.props.startedAt ??= new Date(now);
    this.props.completedAt = new Date(now);
    return true;
  }

  fail(reason: string, now: Date): boolean {
    if (this.isTerminal()) {
      return false;
    }
    this.props.status = BROADCAST_CAMPAIGN_STATUS.FAILED;
    this.props.failureReason = reason;
    this.props.completedAt = new Date(now);
    return true;
  }

  toSnapshot(): BroadcastCampaignProps {
    return {
      ...this.props,
      action: this.action,
      createdAt: new Date(this.props.createdAt),
      startedAt: this.props.startedAt == null ? null : new Date(this.props.startedAt),
      completedAt: this.props.completedAt == null ? null : new Date(this.props.completedAt),
    };
  }
}
