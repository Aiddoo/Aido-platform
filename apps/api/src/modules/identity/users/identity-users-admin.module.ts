import { Module } from "@nestjs/common";

import { PlanningTodoQueriesModule } from "#api/modules/planning/todos/planning-todo-queries.public";

import { IDENTITY_USERS_ADMIN_PROVIDERS } from "./identity-users.providers.js";
import { GrowthController } from "./presentation/http/v1/growth.controller.js";

// 관리자 API 문서에만 싣도록 사용자 Module과 나눈다. 할 일 활성화 수는 planning 조회 포트로 센다
@Module({
  imports: [PlanningTodoQueriesModule],
  controllers: [GrowthController],
  providers: [...IDENTITY_USERS_ADMIN_PROVIDERS],
})
export class IdentityUsersAdminModule {}
