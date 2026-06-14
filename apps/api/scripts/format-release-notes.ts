// Émet en Markdown les notes de release pour une version donnée, à partir de la
// source de vérité PATCH_NOTES (apps/api/src/lib/patch-notes.ts).
// Usage : npx tsx apps/api/scripts/format-release-notes.ts <version>
// Utilisé par .github/workflows/release.yml.
import { PATCH_NOTES } from '../src/lib/patch-notes.js'

const version = process.argv[2]
if (!version) {
  console.error('Usage: format-release-notes.ts <version>')
  process.exit(2)
}

const note = PATCH_NOTES.find((n) => n.version === version)
if (!note) {
  console.error(`Aucune entrée PATCH_NOTES pour la version ${version}`)
  process.exit(1)
}

let out = `## ${note.title}\n\n${note.summary}\n`
for (const section of note.sections) {
  out += `\n### ${section.heading}\n`
  for (const item of section.items) out += `- ${item}\n`
}
process.stdout.write(out)
