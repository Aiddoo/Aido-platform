import { ErrorCode } from "@aido/errors";

import { DomainException } from "@/shared/domain/exceptions/domain.exception";

/**
 * Discord 임베드 필드 (키-값)
 */
export interface AdminNotificationField {
	name: string;
	value: string;
	inline?: boolean;
}

/**
 * 관리자 알림 메시지 직렬화 형태.
 *
 * BullMQ 잡 데이터·Discord 프로바이더 send()의 페이로드로 사용된다.
 * (외부 계약 이름은 `AdminNotification`으로 유지 — 소비자 무변경)
 */
export interface AdminNotification {
	/** 알림 제목 */
	title: string;
	/** 알림 본문 */
	body: string;
	/** 추가 필드 (키-값) */
	fields?: AdminNotificationField[];
	/** 메시지 색상 (hex number) */
	color?: number;
}

/**
 * 관리자 알림 메시지 값 객체.
 *
 * 제목·본문은 비어 있을 수 없다(구조적 불변식). Discord 임베드로 렌더링되는
 * 관리자/결제 알림의 표현을 캡슐화하며, `toPayload()`로 큐·프로바이더 계약을
 * 직렬화한다.
 */
export class AdminNotificationMessage {
	private constructor(
		private readonly _title: string,
		private readonly _body: string,
		private readonly _color: number | undefined,
		private readonly _fields: AdminNotificationField[],
	) {}

	static create(input: {
		title: string;
		body: string;
		color?: number;
		fields?: AdminNotificationField[];
	}): AdminNotificationMessage {
		if (input.title.trim().length === 0) {
			throw new DomainException(ErrorCode.SYS_0002, {
				field: "title",
				reason: "관리자 알림 제목은 비어 있을 수 없습니다",
			});
		}
		if (input.body.trim().length === 0) {
			throw new DomainException(ErrorCode.SYS_0002, {
				field: "body",
				reason: "관리자 알림 본문은 비어 있을 수 없습니다",
			});
		}
		return new AdminNotificationMessage(
			input.title,
			input.body,
			input.color,
			input.fields ?? [],
		);
	}

	toPayload(): AdminNotification {
		const payload: AdminNotification = {
			title: this._title,
			body: this._body,
			fields: this._fields,
		};
		if (this._color !== undefined) {
			payload.color = this._color;
		}
		return payload;
	}
}
