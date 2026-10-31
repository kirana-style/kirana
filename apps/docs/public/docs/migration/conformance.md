# Verifying a migration
Source: https://site.kirana-style.workers.dev/docs/migration/conformance

# Verifying a migration

When you rewrite an application's styling, the question is not "does it look
about right" but "is any computed value different, anywhere, in any state".
Screenshots answer that badly: they miss a 1 px border, and they fail loudly over
a font that loaded a frame late.

This project compares **computed styles**.

<!-- ::figure-conformance -->

## The method

1. Serve the same application twice: the build you came from and the new one.
2. Open the same route in both, at several widths, in both colour schemes.
3. Walk every element and read the same property list from `getComputedStyle`,
   including the things that usually hide, like `text-wrap`, `border-style` and
   the geometry of pseudo-elements.
4. Diff, per element and per property.
5. Anything that differs is either a bug in the new build, a bug in the old one,
   or a difference you list explicitly with a reason.

That last point is the discipline: an expected difference is written down, with
why. A file of exceptions that nobody reads is the same as no test.

## Things worth knowing if you build one

- **Normalise colours.** Read them through a probe element rather than comparing
  strings, or `oklch()` and `color-mix()` values compare unequal for silly
  reasons.
- **Wait for a stable DOM**, not a fixed timeout, and stop animations before
  reading.
- **Confirm a difference on a second read.** A late render is not a regression.
- **Check states too**: open a menu, focus a field, hover a row, because that is
  where precedence bugs live.

## How it runs

The harness builds the Kirana app and the two baselines, serves all three, crawls
every route and diffs. It is how the blocks
and every component were verified, and it is what caught the merge-order bugs
that a human review had passed.

The harness runs in a separate repository beside the StyleX port and the
Tailwind original, which this one does not carry.
