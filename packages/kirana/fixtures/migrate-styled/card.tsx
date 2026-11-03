/** @jsxImportSource @emotion/react */
import styled from "@emotion/styled"
import { css, keyframes } from "@emotion/react"

const spin = keyframes({ from: { rotate: "0deg" }, to: { rotate: "360deg" } })

const surface = css({ padding: 16, borderRadius: 8, "&:hover": { boxShadow: "0 1px 2px #0002" } })

const Card = styled.section<{ accent: string }>((props) => ({
  display: "grid",
  gap: 12,
  borderColor: props.accent,
  "@media (min-width: 640px)": { gap: 16 },
}))

const Title = styled("h2")({ fontSize: "1.5rem", lineHeight: 1.25, margin: 0 })

export function Panel({ accent, busy }: { accent: string; busy: boolean }) {
  return (
    <Card accent={accent} css={[surface, busy && { animation: `${spin} 1s linear infinite` }]}>
      <Title css={{ color: accent, "&:hover": { textDecorationLine: "underline" } }}>Usage</Title>
      <p
        css={css`
          margin: 0;
          color: #52525b;
        `}
      >
        Updated hourly.
      </p>
    </Card>
  )
}
