import { Module } from "@nestjs/common";

import { AppConfigAppVersionsModule } from "./app-config-app-versions.module.js";
import { APP_CONFIG_APP_VERSIONS_ADMIN_PROVIDERS } from "./app-config-app-versions.providers.js";
import { AdminAppReleaseController } from "./presentation/http/v1/admin-app-release.controller.js";

// 관리자 API 문서에만 싣도록 공개 조회 모듈과 나누고, 저장소는 그 모듈의 것을 함께 쓴다
@Module({
  imports: [AppConfigAppVersionsModule],
  controllers: [AdminAppReleaseController],
  providers: [...APP_CONFIG_APP_VERSIONS_ADMIN_PROVIDERS],
})
export class AppConfigAppVersionsAdminModule {}
