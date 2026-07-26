import { sharedLocaleDecorator } from "../../../shared/presentation/decorators";
import { reportController } from "../../presentation/report.controller";

export const allowlistedSourceImports = [
	sharedLocaleDecorator,
	reportController,
];
