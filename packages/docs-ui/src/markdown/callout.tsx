import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
} from "@workspace/ui/components/alert"
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Idea01Icon,
} from "@hugeicons/core-free-icons"

/** GitHub's callout kinds, as `> [!NOTE] Title` writes them. */
const KINDS = {
  note: { icon: InformationCircleIcon, variant: "default" },
  tip: { icon: Idea01Icon, variant: "default" },
  important: { icon: CheckmarkCircle02Icon, variant: "default" },
  warning: { icon: Alert02Icon, variant: "destructive" },
  caution: { icon: Alert02Icon, variant: "destructive" },
} as const

type Kind = keyof typeof KINDS

/** A `md-callout` node. */
export function Callout({
  kind,
  title,
  children,
}: {
  kind: string
  title?: string
  children?: React.ReactNode
}) {
  const { icon, variant } = KINDS[kind as Kind] ?? KINDS.note

  return (
    <Alert variant={variant}>
      <AlertIcon icon={icon} />
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}
