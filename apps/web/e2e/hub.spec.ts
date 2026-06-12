import { test, expect } from '@playwright/test'
import { registerUser } from './helpers'

test('le hub affiche une tuile par module FORGE', async ({ page }) => {
  await registerUser(page, 'E2E Hub')
  await page.goto('/hub')

  // Une tuile par module actif du registre
  for (const name of ['PouetPouet', 'Daily', 'Scrum Poker', 'La Roue']) {
    await expect(page.getByRole('heading', { name })).toBeVisible()
  }

  // La tuile PouetPouet mène au dashboard (scope main : le logo du header
  // porte aussi le nom accessible "PouetPouet")
  await page.locator('main').getByRole('link', { name: 'PouetPouet' }).click()
  await page.waitForURL('**/dashboard')
})

test('la page aide affiche la matrice des rôles', async ({ page }) => {
  await registerUser(page, 'E2E Aide')
  await page.goto('/aide')
  await expect(page.getByRole('heading', { name: 'Rôles & permissions sur un board' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Propriétaire' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Réinitialiser le board (annulable Ctrl+Z)' })).toBeVisible()
})
