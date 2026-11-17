// 문구 재료가 템플릿과 맞지 않으면 코드가 어긋난 것이다. 카탈로그 spec이 먼저 잡는다
export function notificationCopyNotRenderable(templateKey: string, variantName: string): Error {
  return new Error(`Notification copy ${templateKey}.${variantName} cannot render its facts`);
}
