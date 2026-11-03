import styled, { css, keyframes } from "styled-components"
import { Link } from "./link"

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`

const center = css`
  display: flex;
  align-items: center;
`

export const Button = styled.button<{ $tone?: "solid" | "quiet"; $wide?: boolean }>`
  ${center}
  gap: 8px;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  animation: ${fadeIn} 150ms ease-out;
  width: ${(p) => (p.$wide ? "100%" : "auto")};

  &:hover {
    background-color: #f4f4f5;
  }
  &:disabled {
    opacity: 0.5;
  }
  &::after {
    content: "";
  }
  & > svg {
    width: 16px;
    height: 16px;
  }
  @media (min-width: 768px) {
    padding: 12px 24px;
  }
  & + & {
    margin-inline-start: 4px;
  }
  ${(p) =>
    p.$tone === "quiet"
      ? css`
          background-color: transparent;
        `
      : css`
          background-color: #18181b;
          color: white;
        `}
`

export const NavLink = styled(Link).attrs({ rel: "noreferrer" })`
  color: inherit;
  text-decoration: none;
  &[aria-current="page"] {
    font-weight: 600;
  }
`

export function Toolbar() {
  return (
    <nav>
      <Button $tone="quiet">Save</Button>
      <NavLink href="/">Home</NavLink>
    </nav>
  )
}
