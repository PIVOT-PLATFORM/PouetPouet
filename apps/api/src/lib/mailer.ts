import nodemailer from 'nodemailer'

// SMTP is optional: when SMTP_HOST is unset we fall back to logging the email to the
// server console, so verification still works in dev without a mail provider.
const SMTP_HOST = process.env.SMTP_HOST
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587)
const SMTP_USER = process.env.SMTP_USER
const SMTP_PASS = process.env.SMTP_PASS
const SMTP_SECURE = process.env.SMTP_SECURE === 'true'
const MAIL_FROM = process.env.MAIL_FROM ?? 'PouetPouet <no-reply@pouetpouet.app>'

export const isSmtpConfigured = Boolean(SMTP_HOST)

let transporter: nodemailer.Transporter | null = null
function getTransporter() {
  if (!isSmtpConfigured) return null
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    })
  }
  return transporter
}

function verificationHtml(name: string, link: string) {
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;background:#f9fafb;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#111827;">
    <div style="max-width:480px;margin:0 auto;padding:40px 24px;">
      <div style="text-align:center;margin-bottom:28px;">
        <span style="display:inline-block;font-size:28px;font-weight:800;color:#4f46e5;letter-spacing:-0.02em;">🎯 PouetPouet</span>
      </div>
      <div style="background:#ffffff;border:1px solid #f3f4f6;border-radius:16px;padding:32px;">
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;">Bonjour ${name},</h1>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4b5563;">
          Bienvenue sur PouetPouet ! Confirmez votre adresse email pour activer votre compte.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${link}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:12px;">
            Vérifier mon adresse email
          </a>
        </div>
        <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#9ca3af;">
          Ou copiez ce lien dans votre navigateur :
        </p>
        <p style="margin:0;font-size:12px;line-height:1.6;word-break:break-all;">
          <a href="${link}" style="color:#4f46e5;">${link}</a>
        </p>
        <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">Ce lien expire dans 24 heures.</p>
      </div>
      <p style="text-align:center;margin:24px 0 0;font-size:11px;color:#cbd5e1;">
        Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement cet email.
      </p>
    </div>
  </body>
</html>`
}

function passwordResetHtml(name: string, link: string) {
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;background:#f9fafb;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#111827;">
    <div style="max-width:480px;margin:0 auto;padding:40px 24px;">
      <div style="text-align:center;margin-bottom:28px;">
        <span style="display:inline-block;font-size:28px;font-weight:800;color:#4f46e5;letter-spacing:-0.02em;">🎯 PouetPouet</span>
      </div>
      <div style="background:#ffffff;border:1px solid #f3f4f6;border-radius:16px;padding:32px;">
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;">Bonjour ${name},</h1>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4b5563;">
          Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${link}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:12px;">
            Réinitialiser mon mot de passe
          </a>
        </div>
        <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#9ca3af;">
          Ou copiez ce lien dans votre navigateur :
        </p>
        <p style="margin:0;font-size:12px;line-height:1.6;word-break:break-all;">
          <a href="${link}" style="color:#4f46e5;">${link}</a>
        </p>
        <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
      </div>
    </div>
  </body>
</html>`
}

export async function sendPasswordResetEmail(to: string, name: string, link: string): Promise<boolean> {
  const tx = getTransporter()
  if (!tx) {
    console.log(`\n📧 [mailer] SMTP non configuré — lien de réinitialisation pour ${to} :\n   ${link}\n`)
    return false
  }
  await tx.sendMail({
    from: MAIL_FROM,
    to,
    subject: 'Réinitialisez votre mot de passe — PouetPouet',
    html: passwordResetHtml(name, link),
  })
  return true
}

/**
 * Sends the account-verification email. Returns true when actually dispatched via SMTP,
 * false when it was only logged to the console (no SMTP configured).
 */
function parcoursReminderHtml(title: string, stepTitle: string, refNumber: string | null, link: string) {
  const ref = refNumber ? ` — Réf. ${refNumber}` : ''
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;background:#f9fafb;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#111827;">
    <div style="max-width:480px;margin:0 auto;padding:40px 24px;">
      <div style="background:#ffffff;border:1px solid #f3f4f6;border-radius:16px;padding:32px;">
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;">Rappel de parcours</h1>
        <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#4b5563;">
          L'étape <strong>${stepTitle}</strong> du parcours <strong>${title}</strong>${ref} est en attente.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${link}" style="display:inline-block;background:#06b6d4;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:12px;">
            Voir le parcours
          </a>
        </div>
      </div>
    </div>
  </body>
</html>`
}

function parcoursStepAssignedHtml(title: string, stepTitle: string, stepNumber: number, refNumber: string | null, link: string) {
  const ref = refNumber ? ` — Réf. ${refNumber}` : ''
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;background:#f9fafb;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#111827;">
    <div style="max-width:480px;margin:0 auto;padding:40px 24px;">
      <div style="background:#ffffff;border:1px solid #f3f4f6;border-radius:16px;padding:32px;">
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;">Action requise</h1>
        <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#4b5563;">
          Une étape vous a été assignée dans le parcours <strong>${title}</strong>${ref}.
        </p>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4b5563;">
          Complétez l'étape <strong>${stepTitle}</strong> (étape ${stepNumber}).
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${link}" style="display:inline-block;background:#06b6d4;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:12px;">
            Compléter l'étape
          </a>
        </div>
      </div>
    </div>
  </body>
</html>`
}

export async function sendParcoursStepAssignedEmail(to: string, title: string, stepTitle: string, stepNumber: number, refNumber: string | null, link: string): Promise<boolean> {
  const tx = getTransporter()
  if (!tx) {
    console.log(`\n📧 [mailer] Assignation parcours pour ${to} : ${title} — ${stepTitle} (étape ${stepNumber})\n   ${link}\n`)
    return false
  }
  await tx.sendMail({
    from: MAIL_FROM,
    to,
    subject: `[Action requise] "${stepTitle}" — ${title}`,
    html: parcoursStepAssignedHtml(title, stepTitle, stepNumber, refNumber, link),
  })
  return true
}

export async function sendParcoursReminderEmail(to: string, title: string, stepTitle: string, refNumber: string | null, link: string): Promise<boolean> {
  const tx = getTransporter()
  if (!tx) {
    console.log(`\n📧 [mailer] Rappel parcours pour ${to} : ${title} — ${stepTitle}\n   ${link}\n`)
    return false
  }
  await tx.sendMail({
    from: MAIL_FROM,
    to,
    subject: `Rappel : "${stepTitle}" en attente — ${title}`,
    html: parcoursReminderHtml(title, stepTitle, refNumber, link),
  })
  return true
}

function formResponseHtml(formTitle: string, link: string) {
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;background:#f9fafb;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#111827;">
    <div style="max-width:480px;margin:0 auto;padding:40px 24px;">
      <div style="background:#ffffff;border:1px solid #f3f4f6;border-radius:16px;padding:32px;">
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;">Nouvelle réponse</h1>
        <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#4b5563;">
          Votre formulaire <strong>${formTitle}</strong> a reçu une nouvelle réponse.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${link}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:12px;">
            Voir les réponses
          </a>
        </div>
      </div>
    </div>
  </body>
</html>`
}

export async function sendFormResponseEmail(to: string, formTitle: string, link: string): Promise<boolean> {
  const tx = getTransporter()
  if (!tx) {
    console.log(`\n📧 [mailer] Nouvelle réponse formulaire pour ${to} : ${formTitle}\n   ${link}\n`)
    return false
  }
  await tx.sendMail({
    from: MAIL_FROM,
    to,
    subject: `Nouvelle réponse : "${formTitle}"`,
    html: formResponseHtml(formTitle, link),
  })
  return true
}

export async function sendVerificationEmail(to: string, name: string, link: string): Promise<boolean> {
  const tx = getTransporter()
  if (!tx) {
    console.log(`\n📧 [mailer] SMTP non configuré — lien de vérification pour ${to} :\n   ${link}\n`)
    return false
  }
  await tx.sendMail({
    from: MAIL_FROM,
    to,
    subject: 'Vérifiez votre adresse email — PouetPouet',
    html: verificationHtml(name, link),
  })
  return true
}
