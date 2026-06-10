import { test, expect } from '@playwright/test'
import { registerUser, createAndOpenBoard } from './helpers'

test('un participant anonyme rejoint une session live', async ({ page, browser }) => {
  // Hôte : board + démarrage de session
  await registerUser(page, 'E2E Hôte')
  await createAndOpenBoard(page, `Session E2E ${Date.now()}`)
  await page.getByRole('button', { name: 'Session' }).click()

  // Le panneau hôte affiche le code d'accès
  const codeButton = page.locator('p:has-text("Code d\'accès") + button')
  await expect(codeButton).toBeVisible({ timeout: 10_000 })
  const code = (await codeButton.innerText()).trim()
  expect(code).not.toBe('')

  // Participant anonyme : nouveau contexte (aucun cookie/storage partagé)
  const anonContext = await browser.newContext()
  const anonPage = await anonContext.newPage()
  await anonPage.goto(`/session/${code}`)
  await anonPage.getByPlaceholder('Votre prénom').fill('Anonyme E2E')
  await anonPage.getByRole('button', { name: /Rejoindre/ }).click()

  await expect(anonPage.getByText('Vous êtes connecté !')).toBeVisible({ timeout: 10_000 })

  // Le compteur de participants du panneau hôte passe à 1 (les noms n'y sont pas affichés) :
  // on cible le plus petit div contenant à la fois le libellé et le compteur.
  const hostHeader = page
    .locator('div')
    .filter({ hasText: 'Session en cours' })
    .filter({ has: page.getByText('1', { exact: true }) })
    .last()
  await expect(hostHeader).toBeVisible({ timeout: 10_000 })

  await anonContext.close()
})
