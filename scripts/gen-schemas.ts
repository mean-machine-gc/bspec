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
import { LifecycleSpec } from './lifecycle';
import { ProcessSpec } from './process';
import { spec } from '../schema/spec';

const BASE_URL = 'https://mean-machine-gc.github.io/ubispec/schema';


spec.forEach( specType => {
    specType.versions.forEach(version => {
        const folderPath = `schema/${specType.name}/${version.version}`
        mkdirSync( folderPath, { recursive: true });
        const lifecycleJson = zodToJsonSchema(LifecycleSpec, {
            name: 'LifecycleSpec',
            $refStrategy: 'none', // inline everything for a flat, portable schema
        });

        lifecycleJson.$id = `${BASE_URL}/lifecycle/v1.0.schema.json`;
        lifecycleJson.title = `${specType.name} UbiSpec ${version.version}`;

        writeFileSync(
            'schema/lifecycle/v1.0.schema.json',
            JSON.stringify(lifecycleJson, null, 2) + '\n',
        );
        console.log('✓ schema/lifecycle/v1.0.schema.json');


    })

})

const tracker = JSON.parse(readFileSync('versions.json', 'utf-8'));

for (const [specType, config] of Object.entries(tracker.specs)) {
  for (const [version, paths] of Object.entries(config.versions)) {

    const folderPath = `schema/${specType}/${version}`
    // generate schema to paths.schema

    // Ensure output directories exist
    mkdirSync( folderPath, { recursive: true });
    // generate docs to paths.docs
    const lifecycleJson = zodToJsonSchema(LifecycleSpec, {
        name: 'LifecycleSpec',
        $refStrategy: 'none', // inline everything for a flat, portable schema
    });

    lifecycleJson.$id = `${BASE_URL}/lifecycle/v1.0.schema.json`;
    lifecycleJson.title = 'Lifecycle UbiSpec v1.0';

    writeFileSync(
        'schema/lifecycle/v1.0.schema.json',
        JSON.stringify(lifecycleJson, null, 2) + '\n',
    );
    console.log('✓ schema/lifecycle/v1.0.schema.json');
  }
}

// Ensure output directories exist
mkdirSync('schema/lifecycle', { recursive: true });
mkdirSync('schema/process', { recursive: true });

// Generate lifecycle schema
const lifecycleJson = zodToJsonSchema(LifecycleSpec, {
  name: 'LifecycleSpec',
  $refStrategy: 'none', // inline everything for a flat, portable schema
});
lifecycleJson.$id = `${BASE_URL}/lifecycle/v1.0.schema.json`;
lifecycleJson.title = 'Lifecycle UbiSpec v1.0';

writeFileSync(
  'schema/lifecycle/v1.0.schema.json',
  JSON.stringify(lifecycleJson, null, 2) + '\n',
);
console.log('✓ schema/lifecycle/v1.0.schema.json');

// Generate process schema
const processJson = zodToJsonSchema(ProcessSpec, {
  name: 'ProcessSpec',
  $refStrategy: 'none',
});
processJson.$id = `${BASE_URL}/process/v1.0.schema.json`;
processJson.title = 'Process UbiSpec v1.0';

writeFileSync(
  'schema/process/v1.0.schema.json',
  JSON.stringify(processJson, null, 2) + '\n',
);
console.log('✓ schema/process/v1.0.schema.json');