import { test, expect } from '@playwright/test'
import { registerUser, createAndOpenBoard } from './helpers'

test('créer un board et ajouter une carte par double-clic', async ({ page }) => {
  await registerUser(page, 'E2E Board')
  await createAndOpenBoard(page, `Board E2E ${Date.now()}`)

  // L'auto-fit masque le canvas ~220ms au montage ; on attend qu'il soit visible.
  await page.waitForTimeout(500)

  // Double-clic au centre du viewport (canvas vide) → création d'une carte TEXT.
  // Sous charge le premier dblclick peut tomber pendant l'auto-fit : un retry suffit
  // (un second dblclick au même endroit toucherait la carte créée, sans en créer d'autre).
  const viewport = page.viewportSize()!
  const cards = page.locator('[data-card-id]')
  await page.mouse.dblclick(viewport.width / 2, viewport.height / 2)
  try {
    await expect(cards).not.toHaveCount(0, { timeout: 3000 })
  } catch {
    await page.mouse.dblclick(viewport.width / 2, viewport.height / 2)
  }
  await expect(cards).not.toHaveCount(0, { timeout: 5000 })
})
