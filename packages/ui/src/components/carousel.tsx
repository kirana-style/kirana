import * as React from "react"
import { css } from "@kirana-style/core"
import useEmblaCarousel from "embla-carousel-react"
import type { UseEmblaCarouselType } from "embla-carousel-react"
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"

import type { Sx } from "../lib/sx"
import { mergeSx } from "../lib/sx"
import { Button } from "./button"
import { Icon } from "../primitives/icon"
import { VisuallyHidden } from "../primitives/visually-hidden"
import { spacing } from "../tokens/spacing"

/**
 * The slide gutter. Embla needs the track pulled back by the same amount each
 * slide is padded, so one constant drives both.
 */
const GUTTER = spacing[4]

const styles = {
  root: css({ position: "relative" }),
  viewport: css({ overflow: "hidden" }),
  trackHorizontal: css({
    display: "flex",
    marginInlineStart: `calc(${GUTTER} * -1)`,
  }),
  trackVertical: css({
    display: "flex",
    flexDirection: "column",
    marginTop: `calc(${GUTTER} * -1)`,
  }),
  item: css({ minWidth: 0, flexShrink: 0, flexGrow: 0, flexBasis: "100%" }),
  itemHorizontal: css({ paddingInlineStart: GUTTER }),
  itemVertical: css({ paddingTop: GUTTER }),

  control: css({
    position: "absolute",
    touchAction: "manipulation",
    borderRadius: "calc(infinity * 1px)",
  }),
  previousHorizontal: css({
    insetBlock: 0,
    insetInlineStart: `calc(${spacing[12]} * -1)`,
    marginBlock: "auto",
  }),
  previousVertical: css({
    top: `calc(${spacing[12]} * -1)`,
    left: "50%",
    translate: "-50% 0",
    rotate: "90deg",
  }),
  nextHorizontal: css({
    insetBlock: 0,
    insetInlineEnd: `calc(${spacing[12]} * -1)`,
    marginBlock: "auto",
  }),
  nextVertical: css({
    bottom: `calc(${spacing[12]} * -1)`,
    left: "50%",
    translate: "-50% 0",
    rotate: "90deg",
  }),
}

type CarouselApi = UseEmblaCarouselType[1]
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>
type CarouselOptions = UseCarouselParameters[0]
type CarouselPlugin = UseCarouselParameters[1]

type CarouselProps = {
  opts?: CarouselOptions
  plugins?: CarouselPlugin
  orientation?: "horizontal" | "vertical"
  setApi?: (api: CarouselApi) => void
}

type CarouselContextProps = {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0]
  api: ReturnType<typeof useEmblaCarousel>[1]
  scrollPrev: () => void
  scrollNext: () => void
  canScrollPrev: boolean
  canScrollNext: boolean
} & CarouselProps

const CarouselContext = React.createContext<CarouselContextProps | null>(null)

function useCarousel() {
  const context = React.useContext(CarouselContext)

  if (!context) {
    throw new Error("useCarousel must be used within a <Carousel />")
  }

  return context
}

function Carousel({
  orientation = "horizontal",
  opts,
  setApi,
  plugins,
  sx,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "className"> &
  CarouselProps & { sx?: Sx }) {
  const [carouselRef, api] = useEmblaCarousel(
    {
      ...opts,
      axis: orientation === "horizontal" ? "x" : "y",
    },
    plugins
  )
  /**
   * Whether either arrow is still usable, read from Embla through
   * `useSyncExternalStore` rather than copied into state from an effect, which
   * would cost a render pass.
   */
  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      if (!api) return () => {}
      api.on("reInit", onStoreChange)
      api.on("select", onStoreChange)
      return () => {
        api.off("reInit", onStoreChange)
        api.off("select", onStoreChange)
      }
    },
    [api]
  )

  const canScrollPrev = React.useSyncExternalStore(
    subscribe,
    () => api?.canScrollPrev() ?? false,
    () => false
  )
  const canScrollNext = React.useSyncExternalStore(
    subscribe,
    () => api?.canScrollNext() ?? false,
    () => false
  )

  const scrollPrev = React.useCallback(() => {
    api?.scrollPrev()
  }, [api])

  const scrollNext = React.useCallback(() => {
    api?.scrollNext()
  }, [api])

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        scrollPrev()
      } else if (event.key === "ArrowRight") {
        event.preventDefault()
        scrollNext()
      }
    },
    [scrollPrev, scrollNext]
  )

  // Handing the instance back to the caller is a genuine side effect.
  React.useEffect(() => {
    if (!api || !setApi) return
    setApi(api)
  }, [api, setApi])

  return (
    <CarouselContext
      value={{
        carouselRef,
        api: api,
        opts,
        orientation:
          orientation || (opts?.axis === "y" ? "vertical" : "horizontal"),
        scrollPrev,
        scrollNext,
        canScrollPrev,
        canScrollNext,
      }}
    >
      <div
        onKeyDownCapture={handleKeyDown}
        role="region"
        aria-roledescription="carousel"
        data-slot="carousel"
        {...props}
        sx={[styles.root, sx]}
      >
        {children}
      </div>
    </CarouselContext>
  )
}

function CarouselContent({
  sx,
  ...props
}: Omit<React.ComponentProps<"div">, "className"> & { sx?: Sx }) {
  const { carouselRef, orientation } = useCarousel()

  return (
    <div ref={carouselRef} data-slot="carousel-content" sx={styles.viewport}>
      <div
        {...props}
        sx={[
          orientation === "horizontal"
            ? styles.trackHorizontal
            : styles.trackVertical,
          sx,
        ]}
      />
    </div>
  )
}

function CarouselItem({
  sx,
  ...props
}: Omit<React.ComponentProps<"div">, "className"> & { sx?: Sx }) {
  const { orientation } = useCarousel()

  return (
    <div
      role="group"
      aria-roledescription="slide"
      data-slot="carousel-item"
      {...props}
      sx={[
        styles.item,
        orientation === "horizontal"
          ? styles.itemHorizontal
          : styles.itemVertical,
        sx,
      ]}
    />
  )
}

function CarouselPrevious({
  sx,
  variant = "outline",
  size = "icon-sm",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "className">) {
  const { orientation, scrollPrev, canScrollPrev } = useCarousel()

  return (
    <Button
      data-slot="carousel-previous"
      variant={variant}
      size={size}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      {...props}
      sx={mergeSx(
        styles.control,
        orientation === "horizontal"
          ? styles.previousHorizontal
          : styles.previousVertical,
        sx
      )}
    >
      <Icon icon={ArrowLeft01Icon} />
      <VisuallyHidden>Previous slide</VisuallyHidden>
    </Button>
  )
}

function CarouselNext({
  sx,
  variant = "outline",
  size = "icon-sm",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "className">) {
  const { orientation, scrollNext, canScrollNext } = useCarousel()

  return (
    <Button
      data-slot="carousel-next"
      variant={variant}
      size={size}
      disabled={!canScrollNext}
      onClick={scrollNext}
      {...props}
      sx={mergeSx(
        styles.control,
        orientation === "horizontal"
          ? styles.nextHorizontal
          : styles.nextVertical,
        sx
      )}
    >
      <Icon icon={ArrowRight01Icon} />
      <VisuallyHidden>Next slide</VisuallyHidden>
    </Button>
  )
}

export {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  useCarousel,
}
