import type { Provider } from "@nestjs/common";

// 운영 조립 목록에서 테스트가 실제로 검증할 공급자만 골라 같은 조립 코드를 쓴다
export function pickProviders(
  providers: readonly Provider[],
  tokens: readonly unknown[],
): Provider[] {
  return providers.filter(
    (provider) =>
      typeof provider === "object" && "provide" in provider && tokens.includes(provider.provide),
  );
}
