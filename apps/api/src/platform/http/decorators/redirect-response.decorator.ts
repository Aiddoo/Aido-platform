import { applyDecorators, Redirect } from "@nestjs/common";

import { RawResponse } from "./raw-response.decorator.js";

/**
 * 핸들러가 돌려준 `{ url }`로 302 이동한다(Nest `@Redirect()`). 성공 envelope가 `{ url }`을 감싸면
 * Nest가 주소를 읽지 못해 envelope 없이 둔다.
 */
export const RedirectResponse = (): MethodDecorator => applyDecorators(Redirect(), RawResponse());
