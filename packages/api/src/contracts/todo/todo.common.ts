import { z } from "zod";

import { TODO_VISIBILITIES, DAYS_OF_WEEK } from "../../vocabulary/todo.types.js";
export const todoVisibilitySchema = z.enum(TODO_VISIBILITIES);
export const dayOfWeekSchema = z.enum(DAYS_OF_WEEK);
