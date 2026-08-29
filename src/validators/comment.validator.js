import z from "zod";
import { positiveId, requiredText } from "./common.validator.js";

export const createCommentSchema = z.object({
  entityType: z.enum(["ticket", "booking", "event"]),
  entityId: positiveId("Invalid entity id"),
  text: requiredText("text"),
});
