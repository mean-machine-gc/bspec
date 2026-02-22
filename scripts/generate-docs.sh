#!/bin/bash
pip install json-schema-for-humans
generate-schema-doc --config-file schema/jsfh-config.yaml schema/lifecycle.v1.schema.json schema/lifecycle-docs.html
generate-schema-doc --config-file schema/jsfh-config.yaml schema/process.v1.schema.json schema/process-docs.html