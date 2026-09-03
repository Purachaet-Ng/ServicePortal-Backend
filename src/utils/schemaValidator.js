import z from "zod";
import createHttpError from "http-errors";

function ruleFor(field) {
  switch (field.type) {
    case "number": {
      let r = z.coerce.number({ error: `${field.label} must be a number` });
      if (field.validation?.min != null) r = r.min(field.validation.min);
      if (field.validation?.max != null) r = r.max(field.validation.max);
      return r;
    }
    case "select":
      return field.options?.length
        ? z.enum(field.options, { error: `${field.label} is not a valid option` })
        : z.string();
    case "multiselect": {
      const r = z.array(z.string());
      return field.options?.length
        ? z.array(z.enum(field.options))
        : r;
    }
    case "checkbox":
      return z.boolean();
    case "user_picker":
      return z.coerce.number().int().positive(`${field.label} must be a user id`);
    case "date":
      return z.coerce.date({ error: `Invalid ${field.label}` });
    default: {
      let r = z.string();
      if (field.validation?.minLength) r = r.min(field.validation.minLength);
      if (field.validation?.maxLength) r = r.max(field.validation.maxLength);
      return r;
    }
  }
}

/** form_schema (data) -> zod schema (code), rebuilt per request. */
export function zodFromFormSchema(formSchema) {
  const shape = {};
  for (const field of formSchema ?? []) {
    let rule = ruleFor(field);
    if (field.required) {
      // "" and [] pass a bare type check — required has to reject them too.
      if (rule instanceof z.ZodString) rule = rule.min(1, `${field.label} is required`);
      if (rule instanceof z.ZodArray) rule = rule.min(1, `${field.label} is required`);
    } else {
      rule = rule.optional().nullable();
    }
    shape[field.key] = rule;
  }
  // strict: an unknown key means the client is out of sync with the schema.
  return z.strictObject(shape);
}

/** Throws 422 with the details shape from API.md §POST /api/tickets. */
export function validateCustomFields(formSchema, customFields) {
  const result = zodFromFormSchema(formSchema).safeParse(customFields ?? {});
  if (result.success) return result.data;

  const errors = result.error.issues.map((issue) => ({
    field: `custom_fields.${issue.path.join(".")}`,
    message: issue.message,
  }));
  throw createHttpError(422, "Submitted fields do not match this request type", {
    code: "VALIDATION_FAILED",
    errors,
  });
}