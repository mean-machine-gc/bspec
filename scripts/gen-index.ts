/**
 * UbiSpec — Generate Machine-Readable Index of All Specs
 *
 * Usage: npx tsx scripts/gen-index.ts
 *
 * Generates index.json with complete URLs for all specs, versions, schemas, and docs
 */
import { writeFileSync } from 'fs';
import { spec } from '../schema/spec';
import * as path from 'path';

// Base URLs for different resources
const GITHUB_REPO_BASE = 'https://github.com/mean-machine-gc/bspec';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/mean-machine-gc/bspec/main';
const DOCS_BASE = 'https://mean-machine-gc.github.io/bspec';

// Type definitions for the index structure
interface IndexEntry {
  schema: string;      // Full URL to JSON schema
  zod: string;         // Full URL to TypeScript file
  export: string;      // Export name (e.g., "LifecycleSpec")
  docs: string;        // Full URL to documentation
  status: string;      // "stable" or "unstable"
}

interface IndexSpec {
  description: string;
  versions: Record<string, IndexEntry>;
  latest: string;
}

interface Index {
  specs: Record<string, IndexSpec>;
  generated: string;   // ISO timestamp
  repo: string;        // GitHub repo URL
  docs: string;        // Documentation site URL
}

/** Format version name for display (v1-0 → v1.0) */
function formatVersionForDisplay(version: string): string {
  return version === 'v1-0' ? 'v1.0' : version;
}

/** Generate export name for a spec (e.g., LifecycleSpec) */
function getExportName(specName: string): string {
  return specName.charAt(0).toUpperCase() + specName.slice(1) + 'Spec';
}

/** Find the latest stable version from a list of versions */
function getLatestStableVersion(versions: any[]): string {
  const stableVersions = versions.filter(v => v.stable);
  if (stableVersions.length === 0) {
    return 'next'; // Default to next if no stable versions
  }
  // Return the first stable version (assuming they're ordered)
  return formatVersionForDisplay(stableVersions[0].version);
}

/** Generate the index.json file */
function generateIndex() {
  const index: Index = {
    specs: {},
    generated: new Date().toISOString(),
    repo: GITHUB_REPO_BASE,
    docs: DOCS_BASE
  };

  // Process each spec
  for (const specDef of spec) {
    const specEntry: IndexSpec = {
      description: specDef.description,
      versions: {},
      latest: getLatestStableVersion(specDef.versions)
    };

    // Process each version
    for (const version of specDef.versions) {
      const versionDisplay = formatVersionForDisplay(version.version);
      
      const entry: IndexEntry = {
        schema: `${GITHUB_RAW_BASE}/schema/${specDef.name}/${version.version}/${version.version}.schema.json`,
        zod: `${GITHUB_REPO_BASE}/blob/main/schema/${specDef.name}/${version.version}/${specDef.name}.ts`,
        export: getExportName(specDef.name),
        docs: `${DOCS_BASE}/schema/${specDef.name}/${versionDisplay}/`,
        status: version.stable ? 'stable' : 'unstable'
      };

      specEntry.versions[versionDisplay] = entry;
    }

    index.specs[specDef.name] = specEntry;
  }

  // Write the index file
  const outputPath = path.join(process.cwd(), 'index.json');
  writeFileSync(outputPath, JSON.stringify(index, null, 2) + '\n');
  console.log(`✓ Generated ${outputPath}`);
}

// Run the generator
generateIndex();