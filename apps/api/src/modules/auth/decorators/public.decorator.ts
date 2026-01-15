import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * 인증이 필요없는 공개 라우트를 표시하는 데코레이터
 *
 * @example
 * ```typescript
 * @Public()
 * @Post('login')
 * async login() { ... }
 * ```
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
