// What StyleX reads one way and Kirana another (KF-074), as StyleX's own benchmark fixtures write it.
import * as stylex from '@stylexjs/stylex';
import { sizes } from './sizes.stylex.js';
import { colors } from './colors.stylex';

const DARK = '@media (prefers-color-scheme: dark)';

export const spacing = stylex.defineConsts({ small: '4px' });

export const surface = stylex.defineVars({
  canvas: { default: 'white', '@media (prefers-color-scheme: dark)': 'black' },
  print: { default: 'white', '@media print': 'white', [DARK]: 'black' },
});

const systemTheme = {
  '--accent': { default: 'blue', [DARK]: 'lightblue' },
};

export const SystemTheme = stylex.createTheme(colors, systemTheme);
export const accent = [systemTheme['--accent'].default, systemTheme['--accent'][DARK]];

const spin = stylex.keyframes({
  from: { start: 0, borderWidth: 1 },
  to: { start: 10, borderWidth: 2 },
});

export const styles = stylex.create({
  button: {
    borderWidth: 1,
    borderTopStartRadius: 4,
    marginHorizontal: -8,
    transitionDuration: 150,
    lineHeight: 1.25,
    opacity: 0,
    minHeight: ['100vh', '100dvh'],
    float: 'start',
    color: 'black',
    ':hover': {
      color: 'blue',
      paddingStart: 2,
    },
    '@media (min-width: 600px)': {
      padding: 12,
      ':hover': { color: 'green' },
    },
    '::placeholder': {
      color: 'gray',
      ':focus': { color: 'silver' },
    },
    ':autofill + label': { color: 'red' },
  },
  link: { color: { default: 'blue', ':focus': 'navy' }, ':hover': { color: 'purple' } },
  sized: (size) => ({ width: size, height: 20, animationName: spin }),
  loud: { fontWeight: 'bold !important' },
});
