import { test, expect } from '@playwright/test'
import { registerUser } from './helpers'

test('le hub affiche une tuile par module FORGE', async ({ page }) => {
  await registerUser(page, 'E2E Hub')
  await page.goto('/hub')

  // Une tuile par module actif du registre (grille « Tous les outils »)
  for (const name of ['PouetPouet', 'Daily', 'Scrum Poker', 'La Roue']) {
    await expect(page.getByRole('heading', { name })).toBeVisible()
  }

  // SignDoc est un vrai module gated par flag (OFF par défaut) : absent du hub.
  await expect(page.getByText('SignDoc')).toHaveCount(0)

  // La tuile PouetPouet mène au dashboard (scope main : le logo du header
  // porte aussi le nom accessible "PouetPouet")
  await page.locator('main').getByRole('link', { name: 'PouetPouet' }).click()
  await page.waitForURL('**/dashboard')
})

test('l\'Explorateur présente les outils actuels et à venir + capte l\'intérêt', async ({ page }) => {
  await registerUser(page, 'E2E Explorer')
  await page.goto('/hub')

  // Depuis le hub, le CTA mène à l'Explorateur
  await page.getByRole('link', { name: /Explorer les domaines/ }).click()
  await page.waitForURL('**/explorer')

  // Domaines et outils à venir présents
  await expect(page.getByRole('heading', { name: 'Architecture', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Cartographie SI', exact: true })).toBeVisible()

  // Exprimer un intérêt bascule le bouton (scopé à la carte « Cartographie SI »)
  const card = page.locator('div.rounded-2xl').filter({ hasText: 'Cartographie SI' }).first()
  await card.getByRole('button', { name: "M'intéresse" }).click()
  await expect(card.getByRole('button', { name: "Ça m'intéresse" })).toBeVisible()
})

test('le changement de palette s\'applique et persiste', async ({ page }) => {
  await registerUser(page, 'E2E Palette')
  await page.goto('/profile')

  // Sélection de la palette FDE Bleu-Vert → data-palette posé sur <html>
  await page.getByRole('button', { name: 'Palette FDE Bleu-Vert' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'fde-bleu-vert')

  // La couleur primaire a réellement changé (bouton Sauvegarder = bg-primary-600).
  // poll : le bouton a une transition-colors, on attend la fin de l'animation.
  await expect
    .poll(async () => page.getByRole('button', { name: 'Sauvegarder' }).first()
      .evaluate((el) => getComputedStyle(el).backgroundColor), { timeout: 3000 })
    .toBe('rgb(16, 87, 200)') // #1057c8 — FDE bleu moyen

  // Persiste après rechargement
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'fde-bleu-vert')

  // Retour au défaut
  await page.getByRole('button', { name: 'Palette Défaut' }).click()
  await expect(page.locator('html')).not.toHaveAttribute('data-palette', /./)
})

test('la page aide affiche la matrice des rôles (section dépliable)', async ({ page }) => {
  await registerUser(page, 'E2E Aide')
  await page.goto('/aide')
  // La section est repliée par défaut : le titre est visible, pas le tableau
  const heading = page.getByRole('heading', { name: 'Rôles & permissions sur un board' })
  await expect(heading).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Propriétaire' })).not.toBeVisible()
  // Dépliage → la matrice apparaît
  await heading.click()
  await expect(page.getByRole('columnheader', { name: 'Propriétaire' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Réinitialiser le board (annulable Ctrl+Z)' })).toBeVisible()
})
