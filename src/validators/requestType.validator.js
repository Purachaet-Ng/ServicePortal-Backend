import z from "zod";
import { positiveId, requiredText } from "./common.validator.js";

export const deptIdParams = z.object({
  deptId: positiveId("Invalid department id"),
});

export const requestTypeBodySchema = z.object({
  name: requiredText("name"),
  description: z.string().trim().nullish(),
  formSchema: z
    .array(z.record(z.string(), z.unknown()))
    .min(1, "formSchema must not be empty"),
  defaultAssigneeId: positiveId("Invalid assignee id").nullish(),
});

export const createRequestTypeSchema = requestTypeBodySchema;

export const updateRequestTypeSchema = requestTypeBodySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });
