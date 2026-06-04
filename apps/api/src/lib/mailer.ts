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
