import { createHash } from "node:crypto";

export function verifyArchive(metadata, bytes) {
  if (metadata.name !== "@waffo/pancake-cli") throw new Error("Unexpected package name");
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(metadata.version)) throw new Error("Only stable versions belong in Homebrew");
  const expected = `https://registry.npmjs.org/@waffo/pancake-cli/-/pancake-cli-${metadata.version}.tgz`;
  if (metadata.dist?.tarball !== expected) throw new Error("Unexpected tarball origin/path");
  const integrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
  if (metadata.dist.integrity !== integrity) throw new Error("npm archive integrity mismatch");
  return createHash("sha256").update(bytes).digest("hex");
}

export function renderFormula(metadata, sha256) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:alpha|beta|rc)\.(0|[1-9]\d*))?$/.test(metadata.version)) throw new Error("Invalid CLI version");
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("Invalid SHA256");
  return `# Generated from the verified npm archive. Do not edit version or hash manually.
require "json"

class Pancake < Formula
  desc "Developer CLI for Waffo Pancake"
  homepage "https://github.com/waffo-com/waffo-pancake-cli"
  url "https://registry.npmjs.org/@waffo/pancake-cli/-/pancake-cli-${metadata.version}.tgz"
  sha256 "${sha256}"
  license "MIT"

  depends_on "node@22"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    result = JSON.parse(shell_output("#{bin}/pancake --version --json"))
    assert_equal true, result.fetch("ok")
    assert_equal version.to_s, result.fetch("data").fetch("version")
    help = JSON.parse(shell_output("#{bin}/pancake --help --json"))
    assert_equal true, help.fetch("ok")
    assert_match "Usage: pancake", help.fetch("data").fetch("help")
  end
end
`;
}

export function compareStable(a, b) {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  return 0;
}
