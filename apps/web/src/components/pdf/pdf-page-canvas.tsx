'use client'
import { useEffect, useRef, useState } from 'react'

interface Props {
  docUrl: string
  pageNumber: number  // 1-based
  scale?: number
  className?: string
}

export function PdfPageCanvas({ docUrl, pageNumber, scale = 1, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setError(false)

    async function render() {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString()

        const pdf = await pdfjsLib.getDocument({ url: docUrl, withCredentials: false }).promise
        if (cancelled) return

        const page = await pdf.getPage(pageNumber)
        if (cancelled) return

        const viewport = page.getViewport({ scale })
        const canvas = canvasRef.current
        if (!canvas || cancelled) return

        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({ canvas, viewport }).promise
      } catch {
        if (!cancelled) setError(true)
      }
    }

    render()
    return () => { cancelled = true }
  }, [docUrl, pageNumber, scale])

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 text-gray-400 text-xs ${className ?? ''}`}>
        Erreur
      </div>
    )
  }

  return <canvas ref={canvasRef} className={className} />
}
