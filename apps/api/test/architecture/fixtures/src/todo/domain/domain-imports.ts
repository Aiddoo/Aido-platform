import { sharedLocaleDecorator } from "../../shared/presentation/decorators";
import { todoController } from "../presentation/todo.controller";

export const forbiddenDomainImports = [sharedLocaleDecorator, todoController];
