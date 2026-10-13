/**
 * Markdown's comment components, dispatched by name.
 *
 * `<!-- ::example name="button-variants" -->` parses into a component node with
 * no tag of its own, so the renderer emits `md-comment-component` carrying
 * `data-component` and a JSON `data-attributes`. The app registers what its
 * pages can embed; an unknown name says so on the page rather than rendering
 * nothing.
 */
export type CommentRegistry = Record<
  string,
  React.ComponentType<Record<string, unknown>>
>

export function createCommentComponent(registry: CommentRegistry) {
  return function CommentComponent({
    "data-component": name,
    "data-attributes": attributes,
    children,
  }: {
    "data-component"?: string
    "data-attributes"?: string
    children?: React.ReactNode
  }) {
    const Component = name ? registry[name] : undefined
    if (!Component) {
      return (
        <p>
          unknown documentation component {JSON.stringify(name ?? "")} — add it
          to the markdown component map
        </p>
      )
    }
    const props = attributes
      ? (JSON.parse(attributes) as Record<string, unknown>)
      : {}
    // A block component (`<!-- ::start:name -->` … `<!-- ::end:name -->`) renders its content.
    return <Component {...props}>{children}</Component>
  }
}
