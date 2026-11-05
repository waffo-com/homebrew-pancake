# Waffo Pancake Homebrew tap

Distribution infrastructure for [`@waffo/pancake-cli`](https://github.com/waffo-com/waffo-pancake-cli).

**Not released yet.** No installable formula is provided until the first stable npm version exists and passes installation checks. After that release:

```sh
brew tap waffo-com/pancake
brew install waffo-com/pancake/pancake
pancake --help
```

The qualified name avoids tap conflicts; `brew install pancake` also works when unambiguous. Homebrew installs Node.js 22 and the same npm archive used by npm/npx. The executable wrapper selects Homebrew's Node.js directly, so an existing Node.js installation or PATH change is unnecessary. Installation tests also run with an empty external PATH.

## Automatic updates

`Update from npm` checks npm's `latest` channel every six hours or via Actions workflow dispatch. It verifies SHA-512 integrity, computes SHA-256, installs/tests on macOS and Linux, then commits only the tested formula. No cross-repository token is required. GitHub schedules may be delayed; dispatch manually for immediate synchronization.

Prereleases are excluded. An unpublished package produces a bootstrap no-op. Network errors, mismatched hashes, unexpected origins and downgrades fail the workflow. Failed installation leaves the existing formula unchanged.

Before the first stable release, Tap CI checks the tap tooling and explicitly reports installation as pending. It does not access private CLI source. The CLI's own CI uses its tested archive and a pinned public tap revision to install a local-only candidate on macOS/Linux. Local candidates may include CLI prereleases; the stable npm updater still rejects them. Neither path publishes a placeholder package or commits a local candidate as a production formula.

## Maintainers

```sh
node --test scripts/*.test.mjs
node scripts/update.mjs
# On a clean machine, after the first stable release:
bash scripts/test-formula.sh Formula/pancake.rb
```

The updater uses contents-write permission to commit to main after both platform tests. Branch rules must allow the updater or the workflow must be changed to a PR-based flow. Ordinary Tap CI is read-only.

After release, upgrade/uninstall with `brew update`, `brew upgrade waffo-com/pancake/pancake` and `brew uninstall waffo-com/pancake/pancake`.

MIT license.
