import z from "zod";
import { requiredText } from "./common.validator.js";

export const departmentSchema = z.object({
    name: requiredText("name")
})