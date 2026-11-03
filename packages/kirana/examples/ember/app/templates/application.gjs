import { css, relation } from '@kirana-style/core';
import { sx } from '@kirana-style/ember';

/**
 * The probe the example runner reads back from the browser. Kirana compiles this module after
 * Embroider has turned it into JavaScript, so `css()` works in a `.gjs` file; the template reaches
 * the handles in scope, and `sx` merges them with the margin, known only from the page.
 */
const styles = {
  probe: css({
    color: 'rgb(1, 2, 3)',
    paddingTop: '7px',
    backgroundColor: { base: 'rgb(250, 250, 250)', ':hover': 'rgb(4, 5, 6)' },
  }),
  quiet: css({ marginLeft: '1px' }),
};

/** Anchored only in the template (KF-090): the build fails if the compiler does not see it there. */
const scope = relation('probe-scope');
const inScope = css({
  paddingBottom: { base: '0px', [scope.within('[data-scope]')]: '6px' },
});

<template>
  <p data-probe="" class={{sx styles.probe styles.quiet}}>Styled by Kirana.</p>
  <div data-scope="" class={{sx scope.anchor}}>
    <span data-probe-anchor="" class={{sx inScope}}>Anchored</span>
  </div>
</template>
