import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const updater = fileURLToPath(new URL('./update.mjs', import.meta.url));
const bytes = Buffer.from('verified archive fixture');
function metadata(version = '1.2.3') {
  return { name: '@waffo/pancake-cli', version, dist: {
    tarball: `https://registry.npmjs.org/@waffo/pancake-cli/-/pancake-cli-${version}.tgz`,
    integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
  } };
}
function runUpdater(t, { value = metadata(), status = 200, oldFormula } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'pancake-update-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const output = join(directory, 'output');
  const calls = join(directory, 'calls');
  const formula = join(directory, 'Formula', 'pancake.rb');
  if (oldFormula !== undefined) { mkdirSync(join(directory, 'Formula')); writeFileSync(formula, oldFormula); }
  const mock = join(directory, 'fetch.mjs');
  writeFileSync(mock, `
    import { appendFileSync } from 'node:fs';
    globalThis.fetch = async (url, options) => {
      appendFileSync(${JSON.stringify(calls)}, url + '\\n');
      if (url === 'https://registry.npmjs.org/@waffo%2Fpancake-cli/latest')
        return new Response(JSON.stringify(${JSON.stringify(value)}), { status: ${status} });
      if (url !== ${JSON.stringify(value?.dist?.tarball)} || options.redirect !== 'error') throw new Error('Unexpected archive request');
      return new Response(Buffer.from(${JSON.stringify(bytes.toString('base64'))}, 'base64'));
    };
  `);
  const result = spawnSync(process.execPath, ['--import', mock, updater], {
    cwd: directory, encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: output }, timeout: 10000,
  });
  assert.ifError(result.error);
  return { ...result, output: existsSync(output) ? readFileSync(output, 'utf8') : '',
    formula: existsSync(formula) ? readFileSync(formula, 'utf8') : undefined,
    calls: readFileSync(calls, 'utf8').trim().split('\n') };
}

test('a candidate on latest skips downloads and preserves any existing stable formula', t => {
  for (const version of ['0.0.1-alpha.1', '0.0.1-beta.2', '0.0.1-rc.1']) {
    for (const oldFormula of [undefined, '# existing stable formula\n']) {
      const result = runUpdater(t, { value: metadata(version), oldFormula });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.output, 'changed=false\n');
      assert.equal(result.calls.length, 1);
      assert.equal(result.formula, oldFormula);
      assert.match(result.stdout, /prerelease/i);
    }
  }
});
test('an unpublished package skips cleanly without a formula', t => {
  const result = runUpdater(t, { status: 404 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.output, 'changed=false\n');
  assert.equal(result.formula, undefined);
  assert.equal(result.calls.length, 1);
});
test('a verified stable package still generates the formula', t => {
  const result = runUpdater(t);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.output, 'changed=true\nversion=1.2.3\n');
  assert.equal(result.calls.length, 2);
  assert.match(result.formula, /pancake-cli-1\.2\.3\.tgz/);
  assert.ok(result.formula.includes(createHash('sha256').update(bytes).digest('hex')));
});
test('malformed candidates and wrong package or origin remain errors', t => {
  const rc = metadata('0.0.1-rc.1');
  for (const value of [
    { ...rc, name: 'different-package' },
    { ...rc, dist: { ...rc.dist, tarball: 'https://example.com/archive.tgz' } },
    metadata('0.0.1-rc.01'),
    { ...rc, dist: undefined },
  ]) {
    const result = runUpdater(t, { value });
    assert.notEqual(result.status, 0);
    assert.equal(result.calls.length, 1);
    assert.equal(result.formula, undefined);
    assert.equal(result.output, '');
  }
});
test('metadata errors, changed archive bytes and downgrades leave the formula untouched', t => {
  const oldFormula = 'url "https://registry.npmjs.org/@waffo/pancake-cli/-/pancake-cli-2.0.0.tgz"\n';
  const stable = metadata();
  for (const options of [
    { status: 500 },
    { value: { ...stable, dist: { ...stable.dist, integrity: 'sha512-invalid' } } },
    { value: stable },
  ]) {
    const result = runUpdater(t, { ...options, oldFormula });
    assert.notEqual(result.status, 0);
    assert.equal(result.formula, oldFormula);
    assert.equal(result.output, '');
  }
});
