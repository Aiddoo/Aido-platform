import { UseGuards } from "@nestjs/common";

import { AdminGuard } from "#api/modules/identity/auth/presentation/http/guards/admin.guard";

/** 관리자 전용 라우트. 전역 JwtAuthGuard가 붙인 사용자의 role을 AdminGuard가 확인한다. */
export const Admin = (): MethodDecorator & ClassDecorator => UseGuards(AdminGuard);
