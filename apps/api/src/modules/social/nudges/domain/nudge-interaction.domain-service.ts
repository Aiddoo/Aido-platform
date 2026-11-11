import type { TodoVisibility } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

const NUDGE_THANKS_REJECTIONS = ["todo-not-completed", "todo-not-public"] as const;

export type NudgeThanksRejection = (typeof NUDGE_THANKS_REJECTIONS)[number];

export type NudgeThanksJudgement =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: NudgeThanksRejection };

// 미리보기에 보일 범위. summary는 이미 전한 감사 수만, recipients는 감사를 받을 친구까지 보인다
export type NudgeThanksPreviewScope = "none" | "summary" | "recipients";

interface NudgeThanksTodoState {
  readonly isTodoCompleted: boolean;
  readonly todoVisibility: TodoVisibility;
}

// 답장·감사는 지금도 친구이고 받은 사람이 소유한 공개 할 일일 때만 할 수 있다
export function isNudgeInteractionAvailable(params: {
  readonly receiverId: string;
  readonly isMutualFriend: boolean;
  readonly todoOwnerId: string;
  readonly todoVisibility: string;
}): boolean {
  return (
    params.isMutualFriend &&
    params.todoOwnerId === params.receiverId &&
    params.todoVisibility === "PUBLIC"
  );
}

// 감사는 완료한 공개 할 일에만 전한다. 완료 전이면 공개 범위보다 먼저 거절한다(출시 앱이 받던 거절 순서)
export function judgeNudgeThanks(params: NudgeThanksTodoState): NudgeThanksJudgement {
  if (!params.isTodoCompleted) {
    return { ok: false, reason: "todo-not-completed" };
  }
  if (params.todoVisibility !== "PUBLIC") {
    return { ok: false, reason: "todo-not-public" };
  }
  return { ok: true };
}

// 완료 전에는 전할 감사가 없다. 앱이 완료 저장보다 먼저 미리보기를 물어도 거절하지 않고 빈 미리보기로 답한다
export function decideNudgeThanksPreviewScope(
  params: NudgeThanksTodoState,
): NudgeThanksPreviewScope {
  return match(judgeNudgeThanks(params))
    .returnType<NudgeThanksPreviewScope>()
    .with({ ok: false, reason: "todo-not-completed" }, () => "none")
    .with({ ok: false, reason: "todo-not-public" }, () => "summary")
    .with({ ok: true }, () => "recipients")
    .exhaustive();
}
