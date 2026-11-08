#!/usr/bin/env bash
set -euo pipefail
formula=$(realpath "$1")
brew tap --custom-remote waffo-com/pancake "$PWD"
tap_root=$(brew --repository waffo-com/pancake)
mkdir -p "$tap_root/Formula"
cp "$formula" "$tap_root/Formula/pancake.rb"
brew style waffo-com/pancake/pancake
brew install --build-from-source waffo-com/pancake/pancake
brew test waffo-com/pancake/pancake
pancake --help
pancake --version
installed_bin=$(brew --prefix waffo-com/pancake/pancake)/bin/pancake
empty_path=$(mktemp -d)
trap 'rmdir "$empty_path"' EXIT
if PATH="$empty_path" command -v node; then
  echo 'Clean installation check must not contain an external Node.js runtime.' >&2
  exit 1
fi
PATH="$empty_path" "$installed_bin" --help
PATH="$empty_path" "$installed_bin" --version
