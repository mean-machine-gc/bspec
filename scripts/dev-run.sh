#!/bin/bash
docker run --rm -it -p 4000:4000 \
  -v "$PWD":/site -w /site \
  -v jekyll-gems:/usr/local/bundle \
  ruby:3.3 bash -c "\
    apt-get update -qq && \
    echo '→ Installing Ruby gems...' && \
    bundle install && \
    echo '→ Starting Jekyll at http://localhost:4000' && \
    bundle exec jekyll serve --host 0.0.0.0 --livereload" 