import { type FactoryProvider } from "@nestjs/common";

import { PaginationService } from "../../shared/application/pagination/services/pagination.service.js";

export const paginationServiceProvider: FactoryProvider<PaginationService> = {
  provide: PaginationService,
  inject: [],
  useFactory: () => new PaginationService(),
};
