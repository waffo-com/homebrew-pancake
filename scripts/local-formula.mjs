// CI-only: install the real CLI tarball before a public npm version exists.
// This file never writes the production Formula directory.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { renderFormula } from "./formula.mjs";

const dir = resolve(process.argv[2]);
const metadata = JSON.parse(readFileSync(resolve(dir, "package.json"), "utf8"));
const archive = resolve(dir, metadata.filename);
const sha256 = createHash("sha256").update(readFileSync(archive)).digest("hex");
if (sha256 !== metadata.sha256) throw new Error("Local CLI archive checksum mismatch");
const formula = renderFormula(metadata, sha256).replace(
  `https://registry.npmjs.org/@waffo/pancake-cli/-/pancake-cli-${metadata.version}.tgz`,
  pathToFileURL(archive).href,
);
mkdirSync("candidate", { recursive: true });
writeFileSync("candidate/pancake.rb", formula);
console.log(`Prepared local-only Homebrew test for ${metadata.version}`);
