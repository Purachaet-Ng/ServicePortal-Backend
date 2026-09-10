import "dotenv/config";
import nodemailer from "nodemailer";

/**
 * Email is a mirror of the in-app notification, not a second system: the
 * fan-outs in notifications.service.js call this with the same recipient and
 * the same sentence they just wrote to the notifications table.
 *
 * Unconfigured is a normal state, not an error. Without SMTP_HOST every call
 * here is a no-op, so a teammate running the API with no mail credentials
 * still gets in-app notifications and no console noise.
 */
let transport;

const getTransport = () => {
  const port = Number(process.env.SMTP_PORT) || 587;

  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 is the only implicit-TLS SMTP port; 587 and 25 start plain and
    // upgrade with STARTTLS, which nodemailer does on its own.
    secure: port === 465,
    // One fan-out is several sendMail calls in a row — pooling keeps them on
    // one connection instead of dialling the server once per recipient.
    pool: true,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  return transport;
};

/**
 * NEVER await this. Callers run after the row it describes is committed and
 * before the response is sent, so awaiting an SMTP round trip would make the
 * API a second slower for mail nobody is waiting on.
 *
 * Returns nothing and throws nothing — same reason the fan-outs swallow their
 * own errors: the change already happened, and a failed email must not be
 * able to turn it into a 500.
 */
export const sendMail = (to, subject, text) => {
  if (!process.env.SMTP_HOST || !to) return;

  return getTransport()
    .sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
    })
    .catch((error) => console.error("[mail] send failed", error));
};
