import { sep } from "node:path"
import { css } from "@kirana-style/core"
import { Card } from "./card"

export function A({ on }: { on: boolean }) {
  return (
    <>
      <p sx="flex flex-col p-4 md:hover:p-1 -m-1 m-auto w-1/2 rounded-t-lg rounded" />
      <p sx="text-sm text-blue-600 hover:text-blue-600/50 text-white text-center text-[13px] text-[#0af]  bg-x" />
      <p sx="text-[rgb(1, 2, 3)] m-[calc(1px_+_2px)]" />
      <p sx="border-2 ease-in-out data-[state=open]:p-1 aria-[expanded]:p-1 data-[open]:p-1" />
      <p sx="hover:p-1 hover:p-4 text-xs outline-[#fff] outline-[3px] outline-2" />
      <p sx={["p-1", on && "p-4", on ? "m-1" : "m-auto"]} />
      <p sx={`p-1`} />
      <p sx="after:content-none after:p-1 before:p-1 p-1" />
      <Card sx="p-4" />
      <p sx />
      <p sx={css({ width: sep })} />
    </>
  )
}

export function Mistakes({ n, on }: { n: number; on: boolean }) {
  return (
    <>
      <p sx={`px-${n}`} />
      <p sx={["p-1", on && `m-${n}`, on ? `w-${n}` : (`w-${n}`)]} />
      <p sx="pad-4 p-99 w-a/2 text-blue-600/150 p-4/50 -p-4 -flex flex-x hovr:p-1 !p-1 p-1! roun group-hover:p-1 peer-checked:p-1 [&_svg]:p-1 text-blue text-transparent text-[] m-[3px] p-[3px" />
    </>
  )
}
