#!/bin/bash
docker run --rm -it -p 4000:4000 \
  -v "$PWD":/site -w /site \
  -v jekyll-gems:/usr/local/bundle \
  ruby:3.3 bash -c "\
    echo '→ Installing Python...' && \
    apt-get update -qq && \
    apt-get install -y -qq python3 python3-pip > /dev/null 2>&1 && \
    echo '→ Installing json-schema-for-humans...' && \
    pip install json-schema-for-humans --quiet --break-system-packages && \
    echo '→ Generating schema docs...' && \
    generate-schema-doc --config-file schema/jsfh-config.yaml schema/lifecycle.v1.schema.json schema/lifecycle-docs.html && \
    generate-schema-doc --config-file schema/jsfh-config.yaml schema/process.v1.schema.json schema/process-docs.html && \
    echo '→ Installing Ruby gems...' && \
    bundle install && \
    echo '→ Starting Jekyll at http://localhost:4000' && \
    bundle exec jekyll serve --host 0.0.0.0 --livereload" 