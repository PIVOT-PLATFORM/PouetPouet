// Single source of truth for the displayed app version: the web package.json,
// which is bumped on each release. Avoids hardcoding the number in the UI.
import pkg from '../../package.json'

export const APP_VERSION = pkg.version as string
