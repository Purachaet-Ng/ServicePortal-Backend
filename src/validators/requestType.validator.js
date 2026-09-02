import z from "zod";
import { positiveId, requiredText } from "./common.validator.js";

export const requestTypeSchema = z.object({
  departmentId: positiveId("Invalid department id"),
  name: requiredText("name"),
  description: z.string().trim().nullish(),
  formSchema: z
    .array(z.record(z.string(), z.unknown()))
    .min(1, "formSchema must not be empty"),
  defaultAssigneeId: positiveId("Invalid assignee id").nullish(),
});

export const createRequestTypeSchema = requestTypeSchema;
