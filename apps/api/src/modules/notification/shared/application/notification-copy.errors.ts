// 문구 재료가 템플릿과 맞지 않으면 코드가 어긋난 것이다. 카탈로그 spec이 먼저 잡는다
export function notificationCopyNotRenderable(templateKey: string, variantName: string): Error {
  return new Error(`Notification copy ${templateKey}.${variantName} cannot render its facts`);
}

// 문구가 알림 길이 한도를 넘으면 카탈로그가 어긋난 것이다
export function notificationCopyTooLong(templateKey: string, variantName: string): RangeError {
  return new RangeError(
    `Notification copy ${templateKey}.${variantName} exceeds the notification length limits`,
  );
}

export function notificationCommentCountInvalid(): RangeError {
  return new RangeError("commentCount must be a positive safe integer");
}
