/**
 * UbiSpec — Generate JSON Schema from Zod
 *
 * Usage: npx tsx schema/generate-json-schema.ts
 *
 * Outputs:
 *   schema/lifecycle/v1.0.schema.json
 *   schema/process/v1.0.schema.json
 */
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { spec } from '../schema/spec';

const BASE_URL = 'https://mean-machine-gc.github.io/ubispec/schema';


spec.forEach( specType => {
    specType.versions.forEach(version => {
        const folderPath = `schema/${specType.name}/${version.version}`
        mkdirSync( folderPath, { recursive: true });
        const jsonSchema = zodToJsonSchema(version.zodSchema, {
            $refStrategy: 'none', // inline everything for a flat, portable schema
        }) as Record<string, unknown>;

        jsonSchema.$id = `${BASE_URL}/${specType.name.toLowerCase()}/${version.version}.schema.json`;
        jsonSchema.title = `${specType.name} UbiSpec ${version.version}`;

        writeFileSync(
            `${folderPath}/${version.version}.schema.json`,
            JSON.stringify(jsonSchema, null, 2) + '\n',
        );
        console.log(`✓ ${folderPath}/${version.version}.schema.json`);


    })

})

