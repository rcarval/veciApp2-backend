const nodemailer = require('nodemailer')
require('dotenv').config()
const logger = require('./logger')

const transporter = nodemailer.createTransport({
  host: process.env.MAILTRAP_HOST || 'sandbox.smtp.mailtrap.io',
  port: Number(process.env.MAILTRAP_PORT || 2525),
  auth: {
    user: process.env.MAILTRAP_USER,
    pass: process.env.MAILTRAP_PASS
  }
})

transporter.verify().then(()=>{
  logger.success('✓ Servidor SMTP (Mailtrap) listo')
}).catch(err=>{
  logger.error('[mailer] Error verificando SMTP:', err && err.message)
})

async function sendMail({ to, subject, text, html }) {
  const mailOptions = {
    from: `${process.env.MAILTRAP_NAME || 'VeciApp'} <${process.env.MAILTRAP_FROM || 'demo@veciapp.test'}>`,
    to, 
    subject, 
    text,
    html // Soporte para HTML
  }
  logger.info(`📧 Enviando email a ${to}`)
  const info = await transporter.sendMail(mailOptions)
  logger.success(`✓ Email enviado (ID: ${info && info.messageId})`)
  return info
}

module.exports = { sendMail }
