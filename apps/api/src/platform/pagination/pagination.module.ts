import { Global, Module } from "@nestjs/common";

import { PaginationService } from "../../shared/application/pagination/services/pagination.service.js";
import { paginationServiceProvider } from "./pagination.providers.js";

/**
 * Pagination 모듈
 * 페이지네이션 관련 유틸리티 제공
 */
@Global()
@Module({
  providers: [paginationServiceProvider],
  exports: [PaginationService],
})
export class PaginationModule {}
