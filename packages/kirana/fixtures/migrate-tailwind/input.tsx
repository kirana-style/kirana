import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva } from "class-variance-authority"
import type { VariantProps } from "class-variance-authority"
import * as Primitive from "react"
import { Profiler } from "react"

import { cn, other } from "./utils"

const badgeVariants = cva(
  "group/badge inline-flex rounded-lg border px-2 text-sm font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:px-1 [&>svg]:size-2 [&>svg]:p-4!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        destructive: "bg-destructive/10 text-destructive dark:bg-destructive/20",
        ghost: "hover:bg-muted dark:hover:bg-muted/50",
        dynamic: someClasses,
      },
      size: {
        sm: "px-1",
        md: "",
      },
      tone: shared,
    },
    compoundVariants: [
      { variant: "ghost", size: "sm", class: "px-0.5" },
      { variant: "default", size: "md", className: "gap-1" },
      spreadCompound,
    ],
    defaultVariants: {
      variant: "default",
    },
    ...rest,
  }
)

const plain = cva(dynamicBase)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant, className }), props.hidden && "opacity-50"),
      },
      props
    ),
    render,
  })
}

function Card({ className: cardClass, open, ...props }: React.ComponentProps<"div"> & { open?: boolean }) {
  return (
    <div
      data-slot="card"
      className={cn(
        "group/card flex flex-col gap-4 rounded-lg p-4 text-sm data-horizontal:flex-row @container/card",
        open && "bg-muted",
        open && cn("underline", "p-2"),
        open ? "border" : undefined,
        (props.hidden) && "opacity-50",
        cardClass,
        null,
        false,
        ...props.extra
      )}
      {...props}
    >
      <p data-slot="card-title" className="font-semibold group-data-[size=sm]/card:text-sm group-hover/card:underline @md/card:p-2">
        Title
      </p>
      <span className="peer size-4" />
      <label className="peer-disabled:opacity-50 -mt-2 w-1/2 bg-[rgb(1,2,3)] [&_svg:not([class*='size-'])]:size-4 after:absolute hover:after:bg-muted" />
      <div className={props.id} />
      <div className={cn(props.id, "p-2")} />
      <div className={cn(props.id, other)} />
      <div className="no-scrollbar data-open:block !p-4 md:[--gap:--spacing(4)] [content-visibility:auto]" />
      <div className="*:data-[slot=x]:p-2 **:[svg]:size-2 *:p-2 *:hover:p-2 hover:*:p-2 [&>a:hover]:p-2 *:after:p-2 [&_svg]:[&_a]:p-2" />
      <div className="dark:text-muted-foreground group-[.x]:p-2 group-md:p-2 peer-bogus:p-2 bogus-4 in-data-[x]:p-2" />
      <div className={(state) => cn("p-2", state.open && "p-4")} />
      <div className={`p-2`} />
      <div className="" />
      <Badge className="px-2" />
      <Primitive.Suspense className="p-4" />
      <Profiler className={cn("p-2", props.id)} />
      <Profiler className="group/x" />
      <this.Thing className="p-2" />
    </div>
  )
}

const Arrow = ({ className }: { className?: string }) => <i className={cn("p-2", className)} />

const button = cn("p-2")

export { Arrow, Badge, Card, badgeVariants, button, plain }
