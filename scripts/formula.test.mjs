import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { verifyArchive, renderFormula, compareStable } from "./formula.mjs";

const bytes = Buffer.from("test archive");
const metadata = { name: "@waffo/pancake-cli", version: "1.2.3", dist: {
  tarball: "https://registry.npmjs.org/@waffo/pancake-cli/-/pancake-cli-1.2.3.tgz",
  integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
} };
test("verified npm archive produces Node formula and executable checks", () => {
  const formula = renderFormula(metadata, verifyArchive(metadata, bytes));
  assert.match(formula, /depends_on "node@22"/);
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
