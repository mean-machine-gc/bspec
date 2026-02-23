/**
 * UbiSpec — Generate Markdown Documentation Tables from Zod
 *
 * Usage: npx tsx scripts/gen-schema-docs.ts
 *
 * Walks Zod schemas and emits markdown tables in OpenAPI/AsyncAPI style:
 * | Field | Type | Description |
 *
 * Outputs:
 *   schema/lifecycle/v1-0/v1-0.docs.md
 *   schema/lifecycle/next/next.docs.md
 *   schema/process/v1-0/v1-0.docs.md
 *   schema/process/next/next.docs.md
 */
import { writeFileSync, mkdirSync } from 'fs';
import { z } from 'zod';
import { spec } from '../schema/spec';
import * as path from 'path';

// Track all schemas we've seen to generate proper links
const schemaRegistry = new Map<z.ZodTypeAny, string>();
const processedSchemas = new Set<string>();
// Track the base schemas that derived schemas are built from
const schemaLineage = new Map<z.ZodTypeAny, z.ZodTypeAny>();

// ─── Type Name Inference ────────────────────────────────────────────────────

/** Get the base schema by unwrapping describe() */
function getBaseSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  // Check if this is a described schema
  if ((schema as any)._def?.description !== undefined) {
    // For most schemas, there's no innerType when described
    // We need to find the base by looking at lineage
    const base = schemaLineage.get(schema);
    if (base) return base;
  }
  return schema;
}

/** Check if two schemas are structurally the same (ignoring description) */
function areSchemasEqual(a: z.ZodTypeAny, b: z.ZodTypeAny): boolean {
  const aType = (a as any).constructor.name;
  const bType = (b as any).constructor.name;
  if (aType !== bType) return false;
  
  // For ZodString, we need very precise matching
  if (aType === 'ZodString') {
    const aChecks = (a as any)._def?.checks || [];
    const bChecks = (b as any)._def?.checks || [];
    
    // Must have same number of checks
    if (aChecks.length !== bChecks.length) return false;
    
    // Get regex patterns using correct access method
    const getRegexPattern = (checks: any[]) => {
      for (const check of checks) {
        const zodDef = (check as any)['_zod']?.def;
        if (zodDef?.format === 'regex' && zodDef.pattern) {
          return zodDef.pattern.source;
        }
      }
      return null;
    };
    
    const aRegex = getRegexPattern(aChecks);
    const bRegex = getRegexPattern(bChecks);
    
    if (aRegex && bRegex) {
      return aRegex === bRegex;
    } else if (aRegex || bRegex) {
      return false; // One has regex, other doesn't
    }
    
    return true;
  }
  
  // For arrays, check element type
  if (aType === 'ZodArray') {
    const aElement = (a as any).element || (a as any)._def?.type;
    const bElement = (b as any).element || (b as any)._def?.type;
    if (!aElement || !bElement) return false;
    return areSchemasEqual(aElement, bElement);
  }
  
  // For unions, check if they have the same structure
  if (aType === 'ZodUnion') {
    const aOptions = (a as any).options || (a as any)._def?.options || [];
    const bOptions = (b as any).options || (b as any)._def?.options || [];
    if (aOptions.length !== bOptions.length) return false;
    
    // Check if the options have the same types (simplified check)
    for (let i = 0; i < aOptions.length; i++) {
      const aOptType = (aOptions[i] as any).constructor.name;
      const bOptType = (bOptions[i] as any).constructor.name;
      if (aOptType !== bOptType) return false;
      
      // For ZodString options, check if they're both strings
      if (aOptType === 'ZodString') {
        // Don't compare further structure for strings in unions
        continue;
      }
      
      // For ZodArray options, check element types
      if (aOptType === 'ZodArray') {
        const aElement = (aOptions[i] as any).element;
        const bElement = (bOptions[i] as any).element;
        if (!aElement || !bElement) continue;
        const aElType = (aElement as any).constructor.name;
        const bElType = (bElement as any).constructor.name;
        if (aElType !== bElType) return false;
      }
      
      // For ZodRecord, just check that both are records
      if (aOptType === 'ZodRecord') {
        continue;
      }
    }
    
    return true;
  }
  
  // For records, check basic structure
  if (aType === 'ZodRecord') {
    return true; // Basic match for now
  }
  
  // For other types, return false to be safe
  return false;
}

/** Find exported name for a schema */
function findExportedName(schema: z.ZodTypeAny): string | undefined {
  // Direct match first
  const directName = schemaRegistry.get(schema);
  if (directName) return directName;
  
  // If this schema has a description, it might be a .describe() version of a base schema
  const hasDescription = !!(schema as any)._def?.description || !!schema.description;
  
  if (hasDescription) {
    // Look for a registered schema that matches structurally
    // Prioritize checking lineage first
    for (const [derivedSchema, baseSchema] of schemaLineage.entries()) {
      if (areSchemasEqual(schema, derivedSchema)) {
        // This matches a derived schema, return the base schema's name
        const baseName = schemaRegistry.get(baseSchema);
        if (baseName) return baseName;
      }
    }
    
    // Then check all registered schemas
    for (const [registeredSchema, name] of schemaRegistry.entries()) {
      if (areSchemasEqual(schema, registeredSchema)) {
        return name;
      }
    }
  }
  
  return undefined;
}

/** Infer a human-readable type string from a Zod schema. */
function inferType(schema: z.ZodTypeAny, depth: number = 0): string {
  // Prevent infinite recursion
  if (depth > 10) {
    return '`any`';
  }
  
  // CRITICAL: Check if this schema corresponds to any exported schema
  const exportedName = findExportedName(schema);
  if (exportedName) {
    return `[${exportedName}](#${toAnchor(exportedName)})`;
  }
  
  // Also check if this is a refinement/effect of a registered schema
  if ((schema as any).constructor.name === 'ZodEffects' || (schema as any).constructor.name === 'ZodOptional' || (schema as any).constructor.name === 'ZodDefault') {
    try {
      let innerSchema = schema;
      if (typeof (schema as any).unwrap === 'function') {
        innerSchema = (schema as any).unwrap();
      } else if (typeof (schema as any).removeDefault === 'function') {
        innerSchema = (schema as any).removeDefault();
      } else if (typeof (schema as any).innerType === 'function') {
        innerSchema = (schema as any).innerType();
      } else if ((schema as any)._def && (schema as any)._def.schema) {
        innerSchema = (schema as any)._def.schema;
      }
      
      const innerRegisteredName = schemaRegistry.get(innerSchema);
      if (innerRegisteredName) {
        if ((schema as any).constructor.name === 'ZodOptional') {
          return `[${innerRegisteredName}](#${toAnchor(innerRegisteredName)}) (optional)`;
        }
        return `[${innerRegisteredName}](#${toAnchor(innerRegisteredName)})`;
      }
    } catch {}
  }
  
  const typeName = (schema as any).constructor.name;
  
  // Handle optionals - but check if the inner type is registered first
  if (typeName === 'ZodOptional') {
    try {
      const innerType = (schema as any).unwrap();
      const innerRegistered = schemaRegistry.get(innerType);
      if (innerRegistered) {
        return `[${innerRegistered}](#${toAnchor(innerRegistered)}) (optional)`;
      }
      return `${inferType(innerType, depth + 1)} (optional)`;
    } catch {
      // fallback
    }
  }
  
  // Handle nullables
  if (typeName === 'ZodNullable') {
    try {
      const innerType = (schema as any).unwrap();
      const innerTypeStr = inferType(innerType, depth + 1);
      return `${innerTypeStr} OR null`;
    } catch {
      // fallback
    }
  }
  
  // Handle defaults - don't add optional marker
  if (typeName === 'ZodDefault') {
    try {
      const innerType = (schema as any).removeDefault();
      return inferType(innerType, depth + 1);
    } catch {
      // fallback
    }
  }
  
  // Handle effects (refine/transform)
  if (typeName === 'ZodEffects') {
    try {
      const innerType = (schema as any).innerType();
      return inferType(innerType, depth + 1);
    } catch {
      // If innerType fails, try to get the schema directly
      if ((schema as any)._def && (schema as any)._def.schema) {
        return inferType((schema as any)._def.schema, depth + 1);
      }
    }
  }

  // For all other types, show the basic type representation
  
  // Primitives
  if (schema instanceof z.ZodString || typeName === 'ZodString') {
    return '`string`';
  }
  else if (schema instanceof z.ZodNumber || typeName === 'ZodNumber') {
    return '`number`';
  }
  else if (schema instanceof z.ZodBoolean || typeName === 'ZodBoolean') {
    return '`boolean`';
  }
  else if (schema instanceof z.ZodLiteral || typeName === 'ZodLiteral') {
    return `\`"${(schema as any).value || (schema as any)._def?.value}"\``;
  }

  // Arrays
  else if (schema instanceof z.ZodArray || typeName === 'ZodArray') {
    const element = (schema as any).element || (schema as any)._def?.type;
    if (element) {
      const elementType = inferType(element, depth + 1);
      // If element type contains union, wrap in parentheses
      if (elementType.includes(' OR ') && !elementType.startsWith('(')) {
        return `(${elementType})[]`;
      } else {
        return `${elementType}[]`;
      }
    } else {
      return '`any`[]';
    }
  }

  // Records
  else if (schema instanceof z.ZodRecord || typeName === 'ZodRecord') {
    const keyType = (schema as any).keyType ? inferType((schema as any).keyType, depth + 1) : '`string`';
    const valType = inferType((schema as any).valueType || (schema as any)._def?.valueType, depth + 1);
    return `Record<${keyType}, ${valType}>`;
  }

  // Enums
  else if (schema instanceof z.ZodEnum || typeName === 'ZodEnum') {
    const values = (schema as any).options || (schema as any)._def?.values || [];
    return values.map((v: any) => `\`"${v}"\``).join(' OR ');
  }

  // Unions
  else if (schema instanceof z.ZodUnion || typeName === 'ZodUnion') {
    const options = (schema as any).options || (schema as any)._def?.options || [];
    const unionTypes = options.map((opt: z.ZodTypeAny) => inferType(opt, depth + 1));
    return unionTypes.join(' OR ');
  }

  // Objects
  else if (schema instanceof z.ZodObject || typeName === 'ZodObject') {
    if (schema.description) {
      const name = extractLinkName(schema.description);
      return `[${name}](#${toAnchor(name)})`;
    }
    return '`object`';
  }

  // Default
  return '`any`';
}

/** Extract a short link name from a description. */
function extractLinkName(desc: string): string {
  const match = desc.match(/^([A-Z][\w\s]+?)(?:\:|\.|\—|$)/);
  return match ? match[1].trim() : desc.split('.')[0].trim();
}

/** Convert a title to a markdown anchor. */
function toAnchor(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ─── Documentation Generation ───────────────────────────────────────────────

/** Generate documentation for a ZodObject as a table */
function generateObjectDoc(schema: z.ZodObject<any>, title: string): string {
  const shape = schema.shape;
  const fields: Array<{name: string, type: string, required: boolean, description: string}> = [];

  for (const [name, fieldSchema] of Object.entries(shape)) {
    const s = fieldSchema as z.ZodTypeAny;
    const typeName = (s as any).constructor.name;
    const required = typeName !== 'ZodOptional' && typeName !== 'ZodDefault';
    const description = s.description ?? '';
    
    
    // Check if this field schema corresponds to an exported schema
    const type = inferType(s);

    fields.push({ name, type, required, description });
  }

  const lines: string[] = [
    `## ${title}`,
    '',
  ];

  if (schema.description) {
    lines.push(schema.description, '');
  }

  lines.push(
    '| Field | Type | Description |',
    '|-------|------|-------------|',
  );

  for (const f of fields) {
    const prefix = f.required ? '**Required.** ' : '_Optional._ ';
    // Make type more human-readable
    let humanType = f.type;
    // Replace [] with 'List of'
    if (humanType.endsWith('[]')) {
      humanType = humanType.slice(0, -2);
      humanType = `List of ${humanType}`;
    }
    
    lines.push(`| \`${f.name}\` | ${humanType} | ${prefix}${f.description} |`);
  }

  lines.push('');
  return lines.join('\n');
}

/** Generate documentation for non-object schemas */
function generateNonObjectDoc(schema: z.ZodTypeAny, name: string, exportName: string): string {
  const typeName = (schema as any).constructor.name;
  const lines: string[] = [
    `## ${name}`,
    '',
  ];

  if (schema.description) {
    lines.push(schema.description, '');
  }

  // Generate table format for unions
  if (typeName === 'ZodUnion') {
    const options = (schema as any).options || [];
    lines.push(
      '| Option | Type | Description |',
      '|--------|------|-------------|'
    );
    
    options.forEach((opt: z.ZodTypeAny, i: number) => {
      const optType = inferType(opt);
      const optDescription = opt.description || `Option ${i + 1}`;
      lines.push(`| ${i + 1} | ${optType} | ${optDescription} |`);
    });
    lines.push('');
    return lines.join('\n');
  }
  
  // Generate table format for enums
  if (typeName === 'ZodEnum') {
    const values = (schema as any).options || [];
    lines.push(
      '| Value | Description |',
      '|-------|-------------|'
    );
    
    values.forEach((value: string) => {
      lines.push(`| \`"${value}"\` | Allowed value |`);
    });
    lines.push('');
    return lines.join('\n');
  }

  // Generate table format for all other types
  lines.push(
    '| Constraint | Value |',
    '|------------|-------|'
  );
  
  if (typeName === 'ZodString') {
    const checks = (schema as any)._def?.checks || [];
    let pattern = '';
    for (const check of checks) {
      if (check.kind === 'regex') {
        pattern = check.regex.source;
        break;
      }
    }
    
    lines.push(`| **Type** | \`string\` |`);
    
    // Add specific patterns for known string types
    if (name === 'PascalName' || pattern === '^[A-Z][a-zA-Z0-9]*$') {
      lines.push(`| **Pattern** | PascalCase identifier |`);
    } else if (name === 'PredicateName' || pattern === '^[a-z][a-z0-9]*(-[a-z0-9]+)*$') {
      lines.push(`| **Pattern** | kebab-case identifier |`);
      lines.push(`| **Description** | Must read as natural language |`);
    } else if (name === 'EventName') {
      lines.push(`| **Pattern** | PascalCase |`);
      lines.push(`| **Description** | Must match a type in the model |`);
    } else if (name === 'DeciderName') {
      lines.push(`| **Pattern** | PascalCase |`);
    } else if (name === 'SourcedEvent') {
      lines.push(`| **Format** | \`EventName from DeciderName\` |`);
      lines.push(`| **Description** | Event with source specification |`);
    } else if (name === 'TargetedCommand') {
      lines.push(`| **Format** | \`CommandName -> DeciderName\` |`);
      lines.push(`| **Description** | Command with target specification |`);
    } else if (name === 'WhenScalar') {
      lines.push(`| **Description** | Single event name trigger |`);
    } else if (pattern) {
      lines.push(`| **Pattern** | \`${pattern}\` |`);
    }
    
    if (name === 'Expression') {
      lines.push(`| **Min Length** | 1 |`);
      lines.push(`| **Description** | Scope annotation, prose description, or TypeScript expression |`);
    }
  }
  else if (typeName === 'ZodArray') {
    const element = (schema as any).element;
    const elementType = inferType(element);
    
    lines.push(`| **Type** | \`Array<${elementType.replace(/\[([^\]]+)\]\(#[^)]+\)/g, '$1')}>\` |`);
    lines.push(`| **Item Type** | ${elementType} |`);
    
    if (name === 'ConstraintList') {
      lines.push(`| **Description** | All predicates must hold |`);
      lines.push(`| **Min Length** | 1 |`);
    } else if (name === 'AssertionList') {
      lines.push(`| **Description** | All assertions must hold after state change |`);
      lines.push(`| **Min Length** | 1 |`);
    }
  }
  else if (typeName === 'ZodRecord') {
    const keyType = (schema as any).keyType ? inferType((schema as any).keyType) : '`string`';
    const valType = inferType((schema as any).valueType || (schema as any)._def?.valueType);
    
    const cleanKeyType = keyType.replace(/[`\[\]]/g, '').replace(/\(#[^)]+\)/g, '');
    const cleanValType = valType.replace(/\[([^\]]+)\]\(#[^)]+\)/g, '$1');
    lines.push(`| **Type** | \`Record<${cleanKeyType}, ${cleanValType}>\` |`);
    lines.push(`| **Key Type** | ${keyType} |`);
    lines.push(`| **Value Type** | ${valType} |`);
    
    if (name === 'PredicateMap') {
      lines.push(`| **Key Format** | kebab-case predicate names |`);
      lines.push(`| **Description** | Maps predicate names to expressions |`);
    } else if (name === 'ConditionalEvent') {
      lines.push(`| **Key Format** | Event name (PascalCase) |`);
      lines.push(`| **Description** | Maps event names to their conditions |`);
    } else if (name === 'ConditionalCommand') {
      lines.push(`| **Key Format** | \`CommandName -> DeciderName\` |`);
      lines.push(`| **Description** | Maps targeted commands to their conditions |`);
    } else if (name === 'InlinePredicate') {
      lines.push(`| **Key Format** | kebab-case predicate name |`);
      lines.push(`| **Constraint** | Must have exactly one key |`);
      lines.push(`| **Description** | Single predicate definition |`);
    }
  }
  else {
    // For other complex types, show basic info
    const baseType = inferType(schema).replace(`[${exportName}](#${toAnchor(exportName)})`, '...');
    lines.push(`| **Type** | ${baseType} |`);
  }

  lines.push('');
  return lines.join('\n');
}

/** Check if a value is a Zod schema */
function isZodSchema(value: any): value is z.ZodTypeAny {
  return value && typeof value === 'object' && value instanceof z.ZodType;
}

/** Format version name for display (v1-0 → v1.0) */
function formatVersionForDisplay(version: string): string {
  return version === 'v1-0' ? 'v1.0' : version;
}

/** Generate Jekyll front matter for documentation */
function generateFrontMatter(specType: any, version: any): string {
  const specName = specType.name.charAt(0).toUpperCase() + specType.name.slice(1);
  const versionDisplay = formatVersionForDisplay(version.version);
  const stability = version.stable ? 'stable' : 'unstable';
  
  return `---
layout: default
title: Schema reference
parent: ${versionDisplay} (${stability})
grand_parent: ${specName} UbiSpec
nav_order: 2
---`;
}

/** Get the appropriate filename for the version */
function getModuleFilename(specType: string, version: string): string {
  return `${specType}.ts`;
}

/** Register ALL exported schemas including imported shared schemas */
async function registerSchemas(moduleExports: any, specType: string, version: string) {
  schemaRegistry.clear();
  processedSchemas.clear();
  schemaLineage.clear();
  
  // First, import and register shared schemas
  try {
    const sharedPath = path.join(process.cwd(), 'schema/shared.ts');
    const sharedExports = await import(sharedPath);
    
    for (const [exportName, exportValue] of Object.entries(sharedExports)) {
      if (isZodSchema(exportValue)) {
        schemaRegistry.set(exportValue, exportName);
      }
    }
  } catch (error) {
    console.warn('Could not load shared schemas:', error);
  }
  
  // Then register module-specific schemas
  // Some of these might be derived from shared schemas (e.g., EventName = PascalName.describe())
  for (const [exportName, exportValue] of Object.entries(moduleExports)) {
    if (isZodSchema(exportValue)) {
      schemaRegistry.set(exportValue, exportName);
      
      // Check if this is derived from another registered schema
      // For example, EventName = PascalName.describe()
      for (const [baseSchema, baseName] of schemaRegistry.entries()) {
        if (baseSchema !== exportValue && areSchemasEqual(exportValue, baseSchema)) {
          // This is a derived schema
          schemaLineage.set(exportValue, baseSchema);
          break;
        }
      }
    }
  }
}

/** Generate documentation for all schemas in a module */
async function generateDocsForVersion(specType: any, version: any): Promise<string> {
  const folderPath = `schema/${specType.name}/${version.version}`;
  const filename = getModuleFilename(specType.name, version.version);
  const modulePath = path.join(process.cwd(), folderPath, filename);
  
  try {
    // Import all exports from the module
    const moduleExports = await import(modulePath);
    
    // Register all schemas first
    await registerSchemas(moduleExports, specType.name, version.version);
    
    
    const sections: string[] = [];
    
    // Add Jekyll front matter
    sections.push(generateFrontMatter(specType, version));
    
    // Add header
    sections.push(`\n# ${specType.name.charAt(0).toUpperCase() + specType.name.slice(1)} UbiSpec ${version.version} — Schema Reference\n`);
    
    // Process the main spec schema first
    const mainSchemaName = `${specType.name.charAt(0).toUpperCase() + specType.name.slice(1)}Spec`;
    if (moduleExports[mainSchemaName] && isZodSchema(moduleExports[mainSchemaName])) {
      const schema = moduleExports[mainSchemaName];
      let unwrappedSchema = schema;
      
      if ((schema as any).constructor.name === 'ZodEffects' || typeof (schema as any).innerType === 'function') {
        try {
          unwrappedSchema = (schema as any).innerType();
        } catch {
          if ((schema as any)._def && (schema as any)._def.schema) {
            unwrappedSchema = (schema as any)._def.schema;
          }
        }
      }
      
      if (unwrappedSchema instanceof z.ZodObject || (unwrappedSchema as any).constructor.name === 'ZodObject') {
        sections.push(generateObjectDoc(unwrappedSchema as z.ZodObject<any>, `${mainSchemaName} Object`));
        processedSchemas.add(mainSchemaName);
      }
    }
    
    // Track which schemas are from the current module vs imported
    const moduleSchemaNames = new Set(Object.keys(moduleExports).filter(k => isZodSchema(moduleExports[k])));
    
    // Process all other exported schemas in a logical order
    const exportedSchemas = Object.entries(moduleExports)
      .filter(([name, value]) => isZodSchema(value) && !processedSchemas.has(name))
      .sort(([a], [b]) => {
        // Sort to put important schemas first
        const priority = ['Decision', 'Reaction', 'ThenSpec', 'WhenSpec', 'OutcomeSpec', 'ConstraintList'];
        const aIndex = priority.indexOf(a);
        const bIndex = priority.indexOf(b);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.localeCompare(b);
      });
    
    for (const [exportName, exportValue] of exportedSchemas) {
      const schema = exportValue as z.ZodTypeAny;
      let unwrappedSchema = schema;
      
      if ((schema as any).constructor.name === 'ZodEffects' || typeof (schema as any).innerType === 'function') {
        try {
          unwrappedSchema = (schema as any).innerType();
        } catch {
          if ((schema as any)._def && (schema as any)._def.schema) {
            unwrappedSchema = (schema as any)._def.schema;
          }
        }
      }
      
      // Generate docs based on schema type
      if (unwrappedSchema instanceof z.ZodObject || (unwrappedSchema as any).constructor.name === 'ZodObject') {
        sections.push(generateObjectDoc(unwrappedSchema as z.ZodObject<any>, `${exportName} Object`));
      } else {
        // Generate documentation for non-object schemas
        sections.push(generateNonObjectDoc(unwrappedSchema, exportName, exportName));
      }
      
      processedSchemas.add(exportName);
    }
    
    // Add documentation for referenced shared schemas that are missing
    // Run this multiple times until no new schemas are found (to handle dependencies)
    let addedNewSchemas = true;
    let iterations = 0;
    const maxIterations = 5;
    
    while (addedNewSchemas && iterations < maxIterations) {
      addedNewSchemas = false;
      iterations++;
      for (const [schema, name] of schemaRegistry.entries()) {
        if (!processedSchemas.has(name) && !moduleSchemaNames.has(name)) {
          const allSections = sections.join('\n');
          const linkPattern = `[${name}](#${toAnchor(name)})`;
          const found = allSections.includes(linkPattern);
          
          if (found) {
            let unwrappedSchema = schema;
            if ((schema as any).constructor.name === 'ZodEffects' || typeof (schema as any).innerType === 'function') {
              try {
                unwrappedSchema = (schema as any).innerType();
              } catch {
                if ((schema as any)._def && (schema as any)._def.schema) {
                  unwrappedSchema = (schema as any)._def.schema;
                }
              }
            }
            
            if (unwrappedSchema instanceof z.ZodObject || (unwrappedSchema as any).constructor.name === 'ZodObject') {
              sections.push(generateObjectDoc(unwrappedSchema as z.ZodObject<any>, `${name} Object`));
            } else {
              sections.push(generateNonObjectDoc(unwrappedSchema, name, name));
            }
            processedSchemas.add(name);
            addedNewSchemas = true;
          }
        }
      }
    }

    return sections.join('\n');
  } catch (error) {
    console.error(`Error processing ${folderPath}/${filename}:`, error);
    return '';
  }
}

// ─── Main Generation Loop ───────────────────────────────────────────────────

async function generateAllDocs() {
  for (const specType of spec) {
    for (const version of specType.versions) {
      const folderPath = `schema/${specType.name}/${version.version}`;
      const outputPath = `${folderPath}/${version.version}.docs.md`;
      
      console.log(`Generating docs for ${specType.name} ${version.version}...`);
      
      const markdown = await generateDocsForVersion(specType, version);
      
      if (markdown) {
        mkdirSync(folderPath, { recursive: true });
        writeFileSync(outputPath, markdown);
        console.log(`✓ ${outputPath}`);
      }
    }
  }
}

// Run the generator
generateAllDocs().catch(console.error);