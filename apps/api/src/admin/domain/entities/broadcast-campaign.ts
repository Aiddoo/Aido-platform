import { ErrorCode } from "@aido/errors";
import type { NotificationAction } from "@aido/validators";
import { DomainException } from "@/shared/domain/exceptions/domain.exception";
import type {
	AdminBroadcastMessage,
	AdminBroadcastType,
	BroadcastMetadata,
	BroadcastTargetFilter,
} from "../broadcast-message";

/**
 * 브로드캐스트 캠페인 애그리게잇.
 *
 * 발송할 알림의 불변식(제목/본문 비어 있지 않음)을 소유하고, 대상 사용자
 * 목록으로부터 벤더 중립 메시지를 조립한다. 전송 채널·대상 조회는 포트가 담당.
 * (도메인이 "무엇을 보내는가"의 규칙을 소유 — 전송 수단은 인프라 관심사)
 */
export class BroadcastCampaign {
	private constructor(
		private readonly _targetFilter: BroadcastTargetFilter,
		private readonly title: string,
		private readonly body: string,
		private readonly action: NotificationAction | undefined,
	) {}

	/**
	 * 캠페인을 생성하며 도메인 불변식을 검증한다.
	 * 제목/본문이 공백뿐이면 SYS_0002(검증 실패)로 거부한다.
	 */
	static create(input: {
		title: string;
		body: string;
		targetFilter: BroadcastTargetFilter;
		action?: NotificationAction;
	}): BroadcastCampaign {
		const title = input.title.trim();
		const body = input.body.trim();

		if (title.length === 0 || body.length === 0) {
			throw new DomainException(ErrorCode.SYS_0002, {
				reason: "브로드캐스트 제목/본문은 비어 있을 수 없습니다",
			});
		}

		return new BroadcastCampaign(input.targetFilter, title, body, input.action);
	}

	get targetFilter(): BroadcastTargetFilter {
		return this._targetFilter;
	}

	/** 외부 URL 액션이 있으면 externalUrl 메타데이터를 파생한다 */
	#metadata(): BroadcastMetadata {
		return this.action?.url ? { externalUrl: this.action.url } : undefined;
	}

	/** 대상 사용자 ID 목록으로부터 발송 메시지를 조립한다 */
	toMessages(
		userIds: string[],
		type: AdminBroadcastType,
	): AdminBroadcastMessage[] {
		const metadata = this.#metadata();
		return userIds.map((userId) => ({
			userId,
			type,
			title: this.title,
			body: this.body,
			action: this.action,
			metadata,
		}));
	}
}
