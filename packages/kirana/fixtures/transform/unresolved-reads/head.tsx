export function Head(props: Record<string, unknown>) {
  return <script>{String(props.script)}</script>
}
