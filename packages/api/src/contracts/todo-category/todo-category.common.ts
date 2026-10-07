import { z } from "zod";

import { REORDER_POSITIONS } from "../../vocabulary/todo-category.types.js";
export const reorderPositionSchema = z.enum(REORDER_POSITIONS);
