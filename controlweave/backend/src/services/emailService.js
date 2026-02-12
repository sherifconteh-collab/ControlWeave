'use strict';

/**
 * Email notification service — wraps nodemailer.
 * Gracefully disabled if SMTP_HOST is not set in environment.
 */

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;

  const nodemailer = require('nodemailer');
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: parseInt(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    } : undefined
  });
  return transporter;
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'ControlWeave <noreply@controlweave.io>';

/**
 * Send a notification email to a user.
 * @param {{ email: string, full_name?: string }} user
 * @param {{ title: string, message: string, link?: string|null }} notification
 */
async function sendNotificationEmail(user, notification) {
  const transport = getTransporter();
  if (!transport) return; // SMTP not configured — silent no-op

  const name = user.full_name || user.email;
  const linkHtml = notification.link
    ? `<p><a href="${notification.link}" style="color:#7c3aed">View in ControlWeave →</a></p>`
    : '';

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#7c3aed;margin-bottom:4px">ControlWeave</h2>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin-bottom:24px"/>
      <p>Hi ${name},</p>
      <h3 style="margin-bottom:8px">${notification.title}</h3>
      <p style="color:#374151">${notification.message}</p>
      ${linkHtml}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin-top:24px"/>
      <p style="color:#9ca3af;font-size:12px">You're receiving this because you have email notifications enabled.
        Manage preferences in <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/settings?tab=notifications">Settings → Notifications</a>.</p>
    </div>`;

  await transport.sendMail({
    from: FROM_EMAIL,
    to: user.email,
    subject: `ControlWeave: ${notification.title}`,
    text: `${notification.title}\n\n${notification.message}${notification.link ? '\n\n' + notification.link : ''}`,
    html
  });
}

module.exports = { sendNotificationEmail };
