import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Response } from "express";

/** 응답을 끝내기 전에 연결이 끊기면 취소되는 신호를 만든다. */
export function abortOnClientDisconnect(response: {
  once(event: "close", listener: () => void): unknown;
  readonly writableFinished: boolean;
}): AbortSignal {
  const controller = new AbortController();
  response.once("close", () => {
    if (!response.writableFinished) {
      controller.abort();
    }
  });
  return controller.signal;
}

/** 앱이 응답을 받기 전에 끊으면 돈이 드는 외부 호출을 이어 가지 않게 넘기는 신호. */
export const ClientAbortSignal = createParamDecorator<undefined, AbortSignal>(
  (_data, context: ExecutionContext) =>
    abortOnClientDisconnect(context.switchToHttp().getResponse<Response>()),
);
