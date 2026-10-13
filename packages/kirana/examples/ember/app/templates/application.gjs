import { css } from '@kirana-style/core';
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

<template>
  <p data-probe="" class={{sx styles.probe styles.quiet}}>Styled by Kirana.</p>
</template>
