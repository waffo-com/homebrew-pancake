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
