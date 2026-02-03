import { z, type ZodTypeAny } from "zod"
import { chatTools } from "../lib/ai/tools"

type JsonSchemaProperty = {
  type?: "string" | "number" | "integer" | "boolean" | "object"
  enum?: Array<string | number | boolean>
  description?: string
}

type JsonSchema = {
  type: "object"
  properties?: Record<string, JsonSchemaProperty>
  required?: string[]
}

export type McpToolDefinition = {
  name: string
  description: string
  inputSchema: ZodTypeAny
}

const toZodEnum = (values: Array<string | number | boolean>): ZodTypeAny => {
  if (values.length === 0) {
    return z.never()
  }

  const literals = values.map((value) => z.literal(value)) as [ZodTypeAny, ...ZodTypeAny[]]
  return z.union(literals)
}

const applyDescription = (schema: ZodTypeAny, description?: string) =>
  description ? schema.describe(description) : schema

const propertyToZod = (property: JsonSchemaProperty): ZodTypeAny => {
  if (property.enum) {
    return applyDescription(toZodEnum(property.enum), property.description)
  }

  switch (property.type) {
    case "string":
      return applyDescription(z.string(), property.description)
    case "number":
      return applyDescription(z.number(), property.description)
    case "integer":
      return applyDescription(z.number().int(), property.description)
    case "boolean":
      return applyDescription(z.boolean(), property.description)
    case "object":
      return applyDescription(z.record(z.unknown()), property.description)
    default:
      return applyDescription(z.unknown(), property.description)
  }
}

const jsonSchemaToZod = (schema: JsonSchema): ZodTypeAny => {
  const required = new Set(schema.required ?? [])
  const properties = schema.properties ?? {}
  const shape: Record<string, ZodTypeAny> = {}

  for (const [key, property] of Object.entries(properties)) {
    const zodProperty = propertyToZod(property)
    shape[key] = required.has(key) ? zodProperty : zodProperty.optional()
  }

  return z.object(shape)
}

export const mcpTools: McpToolDefinition[] = chatTools.map((tool) => ({
  name: tool.function.name,
  description: tool.function.description,
  inputSchema: jsonSchemaToZod(tool.function.parameters as JsonSchema),
}))
