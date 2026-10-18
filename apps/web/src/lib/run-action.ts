// Exécute une mutation en surfaçant toute erreur à l'utilisateur (alert — l'app n'a pas
// de système de toast, c'est le pattern déjà en place dans les modales) et en
// resynchronisant l'UI avec la vérité serveur via `reload` en cas d'échec, pour ne pas
// laisser à l'écran une valeur qui n'a pas été persistée.
//
// Le message affiché est celui renvoyé par l'API (ApiError étend Error, donc .message
// porte déjà le libellé métier — ex. « Cette étape a déjà été décidée » sur un 409).
//
// Retourne true si l'action a réussi — pratique pour ne réinitialiser un formulaire
// (vider un champ) qu'en cas de succès.
export async function runAction(
  action: () => Promise<unknown>,
  reload?: () => void | Promise<void>,
): Promise<boolean> {
  try {
    await action()
    return true
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Une erreur est survenue')
    if (reload) {
      try {
        await reload()
      } catch {
        // resynchronisation best-effort — ne pas masquer l'erreur initiale
      }
    }
    return false
  }
}
