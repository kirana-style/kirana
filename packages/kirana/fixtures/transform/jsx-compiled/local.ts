// Not a JSX runtime: a call to its `jsx` keeps `sx` as it is.
export function jsx(type: unknown, props: unknown) {
  return [type, props]
}
