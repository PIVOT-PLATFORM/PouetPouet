// Custom cursors (white fill + black outline) so the pointer/hand stay visible on the
// light canvas even when the OS cursor theme is white.
function svgCursor(svg: string, hotX: number, hotY: number, fallback: string) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotX} ${hotY}, ${fallback}`
}
const ARROW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M5 3l14 9-7 1-4 7L5 3z" fill="white" stroke="black" stroke-width="1.6" stroke-linejoin="round"/></svg>`
const HAND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24"><path d="M7 11.5V6a1.5 1.5 0 013 0m0 0v-.5a1.5 1.5 0 013 0V6m0 0a1.5 1.5 0 013 0v1.5m0 0a1.5 1.5 0 013 0V14a6 6 0 01-6 6h-2.5a6 6 0 01-4.243-1.757l-3-3a1.5 1.5 0 012.122-2.122L10 14.5" fill="white" stroke="black" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
export const CURSOR_ARROW = svgCursor(ARROW_SVG, 5, 3, 'default')
export const CURSOR_HAND = svgCursor(HAND_SVG, 12, 11, 'grab')
