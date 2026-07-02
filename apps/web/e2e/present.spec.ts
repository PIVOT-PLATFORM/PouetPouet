import { test, expect } from '@playwright/test'
import { registerUser } from './helpers'

test('AC-present-01: le deck se lance, navigue au clavier et se ferme', async ({ page }) => {
  await page.goto('/present')

  // Slide 1 = titre PIVOT
  await expect(page.getByRole('heading', { name: 'PIVOT', exact: true })).toBeVisible()
  await expect(page.getByText('1 / 8')).toBeVisible()

  // Flèche droite → slide suivante (vision)
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('heading', { name: 'Un graphe de données partagé' })).toBeVisible()
  await expect(page.getByText('2 / 8')).toBeVisible()

  // Pastille → aller directement à une slide plus loin (End)
  await page.keyboard.press('End')
  await expect(page.getByRole('heading', { name: 'Explorez Pivot.' })).toBeVisible()

  // Échap ferme le deck (redirige vers /login car non authentifié)
  await page.keyboard.press('Escape')
  await page.waitForURL(/\/login|\/$/)
})

test('AC-present-02: le hub lance la présentation', async ({ page }) => {
  await registerUser(page, 'E2E Present')
  await page.goto('/hub')
  await page.getByRole('link', { name: /Présenter Pivot/ }).click()
  await page.waitForURL('**/present')
  await expect(page.getByRole('heading', { name: 'PIVOT', exact: true })).toBeVisible()
})
