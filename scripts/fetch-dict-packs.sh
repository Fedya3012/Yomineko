#!/usr/bin/env bash
# Downloads the open dictionary data and writes real dictionary packs into packs-src/ (jmdict-words, jmdict-examples, kanjidic).
# Usage: scripts/fetch-dict-packs.sh [version] [extra build-dict-pack args, e.g. --all-words]
# Needs: gh (with GH_TOKEN), curl, unzip, node. Used by the Pages deploy and the "Dictionary packs" workflow.
set -euo pipefail
VERSION="${1:-1}"; shift || true
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/jlpt"
gh release download -R scriptin/jmdict-simplified -p 'jmdict-examples-eng-*.json.zip' -D "$WORK"
gh release download -R scriptin/jmdict-simplified -p 'kanjidic2-en-*.json.zip' -D "$WORK"
(cd "$WORK" && for z in *.zip; do unzip -oq "$z"; done)
for n in 1 2 3 4 5; do
  curl -fsSL "https://raw.githubusercontent.com/elzup/jlpt-word-list/master/src/n$n.csv" -o "$WORK/jlpt/n$n.csv"
done
node scripts/build-dict-pack.mjs \
  --jmdict "$(ls "$WORK"/jmdict-examples-eng-*.json | head -1)" \
  --kanjidic "$(ls "$WORK"/kanjidic2-en-*.json | head -1)" \
  --jlpt-dir "$WORK/jlpt" --version "$VERSION" --out packs-src "$@"
