import { type Page } from '@playwright/test'

// Crée un compte vérifié via le bouton bypass (ALLOW_EMAIL_BYPASS=true en dev)
// avec un email unique, et attend l'arrivée sur le dashboard.
export async function registerUser(page: Page, name = 'E2E User'): Promise<void> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`
  await page.goto('/register')
  await page.getByPlaceholder('Jean Dupont').fill(name)
  await page.getByPlaceholder('vous@exemple.fr').fill(email)
  await page.getByPlaceholder('••••••••').fill('e2e-Password-123!')
  await page.getByRole('button', { name: /Créer sans vérification/ }).click()
  await page.waitForURL('**/dashboard')
}

// Crée un board depuis le dashboard et l'ouvre. Retourne une fois sur /boards/[id].
export async function createAndOpenBoard(page: Page, boardName: string): Promise<void> {
  await page.getByRole('button', { name: 'Nouveau board' }).first().click()
  await page.getByPlaceholder('Rétrospective sprint 42').fill(boardName)
  await page.getByRole('button', { name: 'Créer', exact: true }).click()
  // Le modal se ferme et le board apparaît dans la grille — on l'ouvre.
  await page.getByRole('heading', { name: boardName }).click()
  await page.waitForURL(/\/boards\/.+/)
}
