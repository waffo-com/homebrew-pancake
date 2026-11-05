import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyArchive, renderFormula, compareStable } from "./formula.mjs";

const bytes = Buffer.from("test archive");
const metadata = { name: "@waffo/pancake-cli", version: "1.2.3", dist: {
  tarball: "https://registry.npmjs.org/@waffo/pancake-cli/-/pancake-cli-1.2.3.tgz",
  integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
} };
test("verified npm archive produces Node formula and executable checks", () => {
  const formula = renderFormula(metadata, verifyArchive(metadata, bytes));
  assert.match(formula, /depends_on "node@22"/);
  assert.match(formula, /bin\.env_script_all_files libexec\/"bin", PATH: "#\{Formula\["node@22"\]\.opt_bin\}:\$PATH"/);
  assert.match(formula, /pancake --version/);
  assert.match(formula, /pancake --help/);
});
test("tampered bytes, untrusted URL, different package and prereleases are rejected", () => {
  assert.throws(() => verifyArchive(metadata, Buffer.from("tampered")));
  assert.throws(() => verifyArchive({ ...metadata, name: "different" }, bytes));
  assert.throws(() => verifyArchive({ ...metadata, version: "1.2.3-rc.1" }, bytes));
  assert.throws(() => verifyArchive({ ...metadata, dist: { ...metadata.dist, tarball: "https://evil.example/file" } }, bytes));
  assert.throws(() => renderFormula({ version: '1.0.0"\n system "bad' }, "a".repeat(64)));
});
test("version comparison detects downgrades including multi-digit components", () => {
  assert.equal(compareStable("1.10.0", "1.9.0"), 1);
  assert.equal(compareStable("1.9.0", "1.10.0"), -1);
  assert.equal(compareStable("1.9.0", "1.9.0"), 0);
});

test("generated Homebrew tests validate JSON command envelopes", () => {
  const formula = renderFormula(metadata, verifyArchive(metadata, bytes));
  const harness = `
class Formula
  def self.method_missing(*)
  end
  def self.test(&block)
    @test = block
  end
  def self.test_block
    @test
  end
  def version
    "1.2.3"
  end
  def bin
    "/fake"
  end
  def shell_output(command)
    command.include?("--version") ? ENV.fetch("VERSION_ENVELOPE") : '{"ok":true,"data":{"help":"Usage: pancake"}}'
  end
  def assert_equal(expected, actual)
    raise "unexpected value" unless expected == actual
  end
  def assert_match(expected, actual)
    raise "unexpected help" unless actual.include?(expected)
  end
end
${formula}
Pancake.new.instance_eval(&Pancake.test_block)
`;
  for (const [envelope, passes] of [
    [{ ok: true, data: { version: "1.2.3" } }, true],
    [{ ok: false, data: { version: "1.2.3" } }, false],
    [{ ok: true, data: { version: "9.9.9" } }, false],
  ]) {
    const result = spawnSync("ruby", ["-e", harness], { encoding: "utf8", env: { ...process.env, VERSION_ENVELOPE: JSON.stringify(envelope) } });
    assert.ifError(result.error);
    assert.equal(result.status === 0, passes, result.stderr);
  }
});

test("local candidates preserve prerelease versions while registry verification rejects them", t => {
  const directory = mkdtempSync(join(tmpdir(), "pancake-local-formula-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const artifacts = join(directory, "artifacts");
  mkdirSync(artifacts);
  const script = fileURLToPath(new URL("./local-formula.mjs", import.meta.url));
  for (const version of ["0.0.0", "1.2.3", "1.2.3-alpha.1", "1.2.3-beta.2", "1.2.3-rc.3"]) {
    const filename = `pancake-cli-${version}.tgz`;
    writeFileSync(join(artifacts, filename), bytes);
    writeFileSync(join(artifacts, "package.json"), JSON.stringify({ version, filename, sha256: createHash("sha256").update(bytes).digest("hex") }));
    const result = spawnSync(process.execPath, [script, artifacts], { cwd: directory, encoding: "utf8" });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    const formula = readFileSync(join(directory, "candidate/pancake.rb"), "utf8");
    assert.ok(formula.includes(`pancake-cli-${version}.tgz`));
    assert.match(formula, /url "file:\/\//);
    assert.doesNotMatch(formula, /url "https:/);
    if (version.includes("-")) assert.throws(() => verifyArchive({ ...metadata, version }, bytes), /Only stable versions/);
  }
  writeFileSync(join(artifacts, "package.json"), JSON.stringify({ version: "1.2.3", filename: "pancake-cli-1.2.3.tgz", sha256: "0".repeat(64) }));
  const tampered = spawnSync(process.execPath, [script, artifacts], { cwd: directory, encoding: "utf8" });
  assert.notEqual(tampered.status, 0);
  assert.match(tampered.stderr, /checksum mismatch/);
  for (const version of ["1.2.3-rc.01", "1.2.3-dev.1", "01.2.3"]) assert.throws(() => renderFormula({ version }, "a".repeat(64)), /Invalid CLI version/);
});
