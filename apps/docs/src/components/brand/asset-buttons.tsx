/**
 * The two actions every brand file offers: copy its SVG source, or download it.
 */
import { useState } from "react"
import {
  Copy01Icon,
  Download04Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"

import { Button } from "@workspace/ui/components/button"
import { Icon } from "@workspace/ui/primitives/icon"

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={copied ? "Copied" : label}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
    >
      <Icon icon={copied ? Tick02Icon : Copy01Icon} />
      {copied ? "Copied" : "Copy SVG"}
    </Button>
  )
}

export function DownloadButton({
  href,
  name,
  label = "Download",
}: {
  /** A file under `public/`, or a `data:` URL built in the page. */
  href: string
  name: string
  label?: string
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      nativeButton={false}
      render={
        <a href={href} download={name}>
          <Icon icon={Download04Icon} />
          {label}
        </a>
      }
    />
  )
}

/** An SVG file's source as a `data:` URL, for a download link with no file on the server. */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
