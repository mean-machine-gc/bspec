/**
 * UbiSpec — Generate Markdown Documentation Tables from Zod
 *
 * Usage: npx tsx schema/generate-docs.ts
 *
 * Walks Zod schemas and emits markdown tables in OpenAPI/AsyncAPI style:
 * | Field | Type | Description |
 *
 * Output can be included in spec pages or written to standalone files.
 */
import { z } from 'zod';

// ─── Type Name Inference ────────────────────────────────────────────────────

/** Infer a human-readable type string from a Zod schema. */
function inferType(schema: z.ZodTypeAny): string {
  const def = schema._def;
  const typeName = def.typeName as string;

  // Unwrap wrappers
  if (typeName === 'ZodOptional') return inferType(def.innerType);
  if (typeName === 'ZodNullable') return inferType(def.innerType);
  if (typeName === 'ZodDefault') return inferType(def.innerType);
  if (typeName === 'ZodEffects') return inferType(def.schema); // .refine() / .transform()

  // Primitives
  if (typeName === 'ZodString') return '`string`';
  if (typeName === 'ZodNumber') return '`number`';
  if (typeName === 'ZodBoolean') return '`boolean`';
  if (typeName === 'ZodLiteral') return `\`"${def.value}"\``;

  // Arrays
  if (typeName === 'ZodArray') {
    const inner = inferType(def.type);
    return `\\[${inner}\\]`;
  }

  // Records (maps)
  if (typeName === 'ZodRecord') {
    const keyType = inferType(def.keyType);
    const valType = inferType(def.valueType);
    return `Map\\<${keyType}, ${valType}\\>`;
  }

  // Enums
  if (typeName === 'ZodEnum') {
    return def.values.map((v: string) => `\`"${v}"\``).join(' \\| ');
  }

  // Unions
  if (typeName === 'ZodUnion') {
    const options = def.options as z.ZodTypeAny[];
    // If the union has a description, use it as a link-like reference
    if (schema.description) {
      return `[${extractLinkName(schema.description)}](#${toAnchor(extractLinkName(schema.description))})`;
    }
    return options.map(inferType).join(' \\| ');
  }

  // Objects — use description to create an anchor link
  if (typeName === 'ZodObject') {
    if (schema.description) {
      const name = extractLinkName(schema.description);
      return `[${name}](#${toAnchor(name)})`;
    }
    return '`object`';
  }

  return '`any`';
}

/** Extract a short link name from a description (first sentence or phrase before colon/period). */
function extractLinkName(desc: string): string {
  // If description starts with a known type-like pattern, use it
  const match = desc.match(/^([A-Z][\w\s]+?)(?:\:|\.|\—|$)/);
  return match ? match[1].trim() : desc.split('.')[0].trim();
}

/** Convert a title to a markdown anchor. */
function toAnchor(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ─── Table Generation ───────────────────────────────────────────────────────

interface FieldInfo {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

/** Extract field information from a ZodObject. */
function extractFields(schema: z.ZodObject<any>): FieldInfo[] {
  const shape = schema.shape;
  const fields: FieldInfo[] = [];

  for (const [name, fieldSchema] of Object.entries(shape)) {
    const s = fieldSchema as z.ZodTypeAny;
    const required = !s.isOptional();
    const description = s.description ?? '';
    const type = inferType(s);

    fields.push({ name, type, required, description });
  }

  return fields;
}

/** Generate a markdown table from a ZodObject. */
function objectToTable(schema: z.ZodObject<any>, title: string): string {
  const fields = extractFields(schema);
  const lines: string[] = [
    `## ${title}`,
    '',
  ];

  // Add object-level description if present
  if (schema.description) {
    lines.push(schema.description, '');
  }

  lines.push(
    '| Field | Type | Description |',
    '|-------|------|-------------|',
  );

  for (const f of fields) {
    const prefix = f.required ? '**Required.** ' : '';
    lines.push(`| \`${f.name}\` | ${f.type} | ${prefix}${f.description} |`);
  }

  lines.push('');
  return lines.join('\n');
}

// ─── Generate All Tables ────────────────────────────────────────────────────

// Re-import the actual schemas for generation
import { LifecycleSpec, Decision } from './lifecycle';
import {
  ProcessSpec,
  Reaction,
  WhenAny,
  WhenAllCross,
  WhenAllShared,
} from './process';

// Lifecycle tables
console.log('# Lifecycle UbiSpec v1.0 — Schema Reference\n');
console.log(objectToTable(
  // Strip .strict() for introspection — shape is the same
  LifecycleSpec.innerType?.() ?? LifecycleSpec as any,
  'Lifecycle Object',
));
console.log(objectToTable(
  Decision.innerType?.() ?? Decision as any,
  'Decision Object',
));

console.log('\n---\n');

// Process tables
console.log('# Process UbiSpec v1.0 — Schema Reference\n');
console.log(objectToTable(
  ProcessSpec.innerType?.() ?? ProcessSpec as any,
  'Process Object',
));
console.log(objectToTable(
  Reaction.innerType?.() ?? Reaction as any,
  'Reaction Object',
));
console.log(objectToTable(WhenAny as any, 'When Any (OR)'));
console.log(objectToTable(WhenAllCross as any, 'When All (AND, cross-decider)'));
console.log(objectToTable(WhenAllShared as any, 'When All (AND, shared source)'));