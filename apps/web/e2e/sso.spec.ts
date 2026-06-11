import { test, expect } from '@playwright/test'

// SSO OIDC (FORGE F5.1) — nécessite Keycloak local + OIDC_* dans apps/api/.env :
//   docker compose --profile sso up -d keycloak
// Le test se skippe proprement si l'API n'a pas d'IdP configuré.

const API = 'http://localhost:4000'

test('connexion SSO via Keycloak : login IdP → compte fédéré → hub', async ({ page }) => {
  const flag = await (await fetch(`${API}/api/auth/oidc/enabled`)).json()
  test.skip(!flag.enabled, 'SSO non configuré (OIDC_ISSUER absent)')

  await page.goto('/login')
  await page.getByRole('link', { name: /Se connecter avec/ }).click()

  // Formulaire de login Keycloak
  await page.waitForURL(/realms\/forge/)
  await page.locator('#username').fill('sso-user')
  await page.locator('#password').fill('sso-password')
  await page.locator('#kc-login').click()

  // Callback → /sso → /hub, connecté
  await page.waitForURL('**/hub', { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'PouetPouet' })).toBeVisible()
})
