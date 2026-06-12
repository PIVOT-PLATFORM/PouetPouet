import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { registerUser } from './helpers'

// Audit d'accessibilité (WCAG 2.1 A/AA) des pages principales via axe-core.
// Bloque uniquement sur les violations critical/serious — les minor/moderate
// sont listées en console pour traitement progressif.

async function checkA11y(page: import('@playwright/test').Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
  for (const v of blocking) {
    for (const n of v.nodes.slice(0, 15)) {
      console.log(`[a11y] ${label} ✗ ${v.id}: ${n.target.join(' ')} — ${n.failureSummary?.split('\n')[1] ?? ''}`)
    }
  }
  const minor = results.violations.filter((v) => v.impact !== 'critical' && v.impact !== 'serious')
  if (minor.length > 0) {
    console.log(`[a11y] ${label} — ${minor.length} violation(s) mineures : ${minor.map((v) => v.id).join(', ')}`)
  }
  expect(
    blocking.map((v) => `${v.id} (${v.impact}) ×${v.nodes.length} — ${v.help}`),
    `Violations bloquantes sur ${label}`,
  ).toEqual([])
}

test('accessibilité : pages publiques', async ({ page }) => {
  await page.goto('/login')
  await checkA11y(page, '/login')
  await page.goto('/register')
  await checkA11y(page, '/register')
})

test('accessibilité : pages applicatives', async ({ page }) => {
  await registerUser(page, 'E2E A11y')
  await checkA11y(page, '/hub')
  await page.goto('/dashboard')
  await checkA11y(page, '/dashboard')
  await page.goto('/daily')
  await checkA11y(page, '/daily')
  await page.goto('/profile')
  await checkA11y(page, '/profile')
  await page.goto('/aide')
  await checkA11y(page, '/aide')
})

test('accessibilité : pages modules', async ({ page }) => {
  await registerUser(page, 'E2E A11y Mod')
  await page.goto('/equipes')
  await checkA11y(page, '/equipes')
  await page.goto('/scrum')
  await checkA11y(page, '/scrum')
  await page.goto('/wheel')
  await checkA11y(page, '/wheel')
  await page.goto('/capacity')
  await checkA11y(page, '/capacity')
})
