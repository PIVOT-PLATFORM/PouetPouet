// Redimensionne une image côté client (canvas) et l'encode en data-URL JPEG — même
// geste que l'avatar utilisateur (profile/page.tsx), extrait ici pour être réutilisé
// par d'autres champs image (ex. couverture/bannière d'une fiche Innovation).
export function resizeImage(file: File, maxPx: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(maxPx / img.width, maxPx / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.src = url
  })
}
