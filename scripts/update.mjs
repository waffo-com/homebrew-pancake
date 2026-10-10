import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { verifyArchive, renderFormula, compareStable } from "./formula.mjs";

const response = await fetch("https://registry.npmjs.org/@waffo%2Fpancake-cli/latest", { signal: AbortSignal.timeout(30000) });
if (response.status === 404) {
  console.log("No public stable npm package yet; no formula will be fabricated.");
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, "changed=false\n");
  process.exit(0);
}
if (!response.ok) throw new Error(`npm metadata HTTP ${response.status}`);
const metadata = await response.json();
// Validate origin before downloading; verifyArchive checks it again with integrity.
if (!/^https:\/\/registry\.npmjs\.org\/@waffo\/pancake-cli\/-\/pancake-cli-\d+\.\d+\.\d+\.tgz$/.test(metadata.dist?.tarball || "")) throw new Error("Unexpected npm URL/version");
const responseBytes = await fetch(metadata.dist.tarball, { redirect: "error", signal: AbortSignal.timeout(60000) });
if (!responseBytes.ok) throw new Error(`npm archive HTTP ${responseBytes.status}`);
const bytes = Buffer.from(await responseBytes.arrayBuffer());
const sha256 = verifyArchive(metadata, bytes);
const path = "Formula/pancake.rb";
const old = existsSync(path) ? readFileSync(path, "utf8") : "";
const current = old.match(/pancake-cli-(\d+\.\d+\.\d+)\.tgz/);
if (current && compareStable(metadata.version, current[1]) < 0) throw new Error("Refusing to downgrade Homebrew; publish a corrected patch release");
const formula = renderFormula(metadata, sha256);
if (current?.[1] === metadata.version && old !== formula) throw new Error("Same version has different formula/hash; inspect before updating");
mkdirSync("Formula", { recursive: true });
writeFileSync(path, formula);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${old !== formula}\nversion=${metadata.version}\n`);
console.log(`Verified npm ${metadata.version}; formula ${old === formula ? "unchanged" : "updated"}.`);
