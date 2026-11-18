import { Reflector } from "@nestjs/core";

/** 인증이 필요 없는 라우트. 전역 JwtAuthGuard가 건너뛴다. */
export const Public = Reflector.createDecorator<void, true>({ transform: () => true });
