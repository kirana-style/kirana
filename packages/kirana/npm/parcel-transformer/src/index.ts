/**
 * Kirana for Parcel (D-070). Parcel runs transformers in worker processes and offers no step that
 * sees every module, so the work is split as it is for Turbopack (D-065): this transformer rewrites
 * styles in each script into class names, and `@kirana-style/postcss` compiles the whole project where the
 * stylesheet says `@kirana;`. The two sessions agree because a class name is a hash of what it
 * styles (D-037).
 *
 *   .parcelrc   { "extends": "@parcel/config-default",
 *                 "transformers": { "*.{js,mjs,jsx,ts,tsx}": ["@kirana-style/parcel-transformer", "..."] } }
 *   .postcssrc  { "plugins": { "@kirana-style/postcss": {} } }
 */
import { Driver } from "@kirana-style/compiler"
import { createReporter, shouldCompile } from "@kirana-style/compiler/host"
import { Transformer } from "@parcel/plugin"

/** The part of Parcel's mutable asset the transformer uses. */
export type Asset = {
  filePath: string
  getCode: () => Promise<string>
  setCode: (code: string) => void
  invalidateOnFileChange: (file: string) => void
}

/** The part of Parcel's plugin logger the transformer uses. */
export type Logger = { warn: (diagnostic: { message: string }) => void }

const drivers = new Map<string, Promise<Driver>>()

/** The session for a project root, opened once per worker. */
export function driverFor(root: string): Promise<Driver> {
  let driver = drivers.get(root)
  if (!driver) {
    driver = Driver.create({ root })
    drivers.set(root, driver)
  }
  return driver
}

const reporter = createReporter()

/** Compiles one script asset in place; errors fail the build, warnings go to Parcel's logger. */
export async function transform({
  asset,
  options,
  logger,
}: {
  asset: Asset
  options: { projectRoot: string }
  logger: Logger
}): Promise<Asset[]> {
  const driver = await driverFor(options.projectRoot)
  if (driver.configFile) asset.invalidateOnFileChange(driver.configFile)
  const source = await asset.getCode()
  if (!shouldCompile(asset.filePath, source, driver.libraries)) return [asset]
  // The engine compiles off Parcel's thread, so its other work goes on meanwhile.
  const result = await driver.transformAsync(asset.filePath, source, {
    map: false,
  })
  for (const dependency of result.dependencies)
    asset.invalidateOnFileChange(dependency)
  reporter.module(
    {
      warn: (message) => logger.warn({ message }),
      error: (message) => {
        throw new Error(message)
      },
    },
    asset.filePath,
    source,
    result.diagnostics
  )
  if (result.code !== undefined) asset.setCode(result.code)
  return [asset]
}

export default new Transformer({
  transform: transform as unknown as ConstructorParameters<
    typeof Transformer
  >[0]["transform"],
})
