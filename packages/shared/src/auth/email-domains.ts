// Domaines mail dont on avertit l'utilisateur à l'inscription : PouetPouet est un
// outil public, auto-hébergé, non homologué pour un usage avec des données
// professionnelles sensibles (classification C0). Purement informatif — non
// bloquant, pas une mesure de sécurité.
export const RESTRICTED_EMAIL_DOMAINS = ['edf.fr', 'enedis.fr']

export function isRestrictedEmailDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  return domain != null && RESTRICTED_EMAIL_DOMAINS.includes(domain)
}
