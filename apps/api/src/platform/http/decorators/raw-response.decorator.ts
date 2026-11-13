import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

/** 성공 envelope로 감싸지 않는 endpoint. 출시 계약 두 곳만 쓰고 새 raw 응답은 만들지 않는다. */
export const RawResponse = Reflector.createDecorator<void, true>({ transform: () => true });

export function isRawResponse(reflector: Reflector, context: ExecutionContext): boolean {
  return (
    reflector.getAllAndOverride(RawResponse, [context.getHandler(), context.getClass()]) === true
  );
}
