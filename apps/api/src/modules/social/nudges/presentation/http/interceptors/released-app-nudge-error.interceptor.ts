import { ErrorCode } from "@aido/api/errors";
import { isSemanticVersionAtLeast } from "@aido/api/vocabulary";
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { catchError, type Observable, throwError } from "rxjs";

import { RequestClientReader } from "#api/platform/http/request-client/request-client.store";
import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";

import { nudgeInteractionNotFound } from "../../../application/nudges.errors.js";

// 1.15.1 이하 앱은 기능 꺼짐을 NUDGE_1105로 알아 보낸 콕 목록을 꺼진 상태로, 시트는 "찾을 수 없음"으로 보인다.
// 앱은 nativeApplicationVersion(숫자 x.y.z)을 보내 RC·TestFlight·preview 빌드도 1.15.2로 1111을 받는다.
// SemVer 프리릴리스(1.15.2-rc.1)는 1.15.2보다 앞이라 1105지만 앱은 그런 값을 보내지 않는다
const NUDGE_INTERACTION_DISABLED_CODE_MIN_APP_VERSION = "1.15.2";

/** 기능 꺼짐(NUDGE_1111)을 모르는 출시 앱에는 같은 경우에 받아 온 NUDGE_1105를 보낸다 */
@Injectable()
export class ReleasedAppNudgeErrorInterceptor implements NestInterceptor {
  readonly #requestClientReader: RequestClientReader;

  constructor(requestClientReader: RequestClientReader) {
    this.#requestClientReader = requestClientReader;
  }

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next
      .handle()
      .pipe(catchError((error: unknown) => throwError(() => this.#forClientApp(error))));
  }

  #forClientApp(error: unknown): unknown {
    const isDisabled =
      error instanceof ErrorCodedException && error.errorCode === ErrorCode.NUDGE_1111;
    if (!isDisabled) {
      return error;
    }
    const { appVersion } = this.#requestClientReader.current();
    return isSemanticVersionAtLeast(appVersion, NUDGE_INTERACTION_DISABLED_CODE_MIN_APP_VERSION)
      ? error
      : nudgeInteractionNotFound();
  }
}
