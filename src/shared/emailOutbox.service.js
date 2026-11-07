import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import EmailOutbox from '../modules/notification/models/EmailOutbox';
import { logger } from './logger';
import config from './config';

const inMemoryOutboxStore = new Map();

/**
 * Build nodemailer transporter strictly from SMTP configuration.
 * Never fallback to jsonTransport which could falsely mark unsent emails as SENT (BE-FIX-04).
 */
export const getTransporter = () => {
  const host = process.env.SMTP_HOST || (process.env.EMAIL_APP ? 'smtp.gmail.com' : config.smtp?.host || '');
  const port = Number(process.env.SMTP_PORT || config.smtp?.port || 587);
  const secure = Boolean(process.env.SMTP_SECURE === 'true' || config.smtp?.secure);
  const user = process.env.SMTP_USER ?? process.env.EMAIL_APP ?? config.smtp?.user ?? '';
  const pass = process.env.SMTP_PASS ?? process.env.EMAIL_APP_PASSWORD ?? config.smtp?.pass ?? '';

  if (!host || !user || !pass) {
    throw new Error('SMTP provider is not configured: missing SMTP_HOST/EMAIL_APP or EMAIL_APP_PASSWORD');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
};

/**
 * Send an email reply to a customer feedback via reliable Email Outbox
 */
export const sendFeedbackReplyEmail = async ({
  to,
  subject,
  message,
  feedbackId,
  actorId = null,
  idempotencyKey = null,
  forceFail = false,
}) => {
  const recipient = (to || '').trim().toLowerCase();
  const cleanKey = idempotencyKey && typeof idempotencyKey === 'string' && idempotencyKey.trim().length > 0
    ? idempotencyKey.trim()
    : null;

  const isDbConnected = mongoose.connection.readyState === 1;

  // 1. Idempotent check: if an email was already SENT with this key, return it immediately
  if (cleanKey) {
    let existing = null;
    if (isDbConnected) {
      existing = await EmailOutbox.findOne({ idempotencyKey: cleanKey });
    } else {
      existing = inMemoryOutboxStore.get(cleanKey);
    }

    if (existing && existing.status === 'SENT') {
      logger.info(`[EmailOutbox] Idempotent hit: Email ${cleanKey} was already SENT.`);
      return {
        success: true,
        status: 'SENT',
        providerMessageId: existing.providerMessageId,
        outbox: existing,
      };
    }
  }

  // 2. Create or find Outbox record in QUEUED state
  let outbox = null;
  if (cleanKey) {
    if (isDbConnected) {
      outbox = await EmailOutbox.findOne({ idempotencyKey: cleanKey });
    } else {
      outbox = inMemoryOutboxStore.get(cleanKey);
    }
  }

  if (!outbox) {
    if (isDbConnected) {
      outbox = new EmailOutbox({
        recipient: recipient || 'no-email@petclinic.local',
        subject,
        content: message,
        targetType: 'FEEDBACK',
        targetId: feedbackId,
        status: 'QUEUED',
        provider: 'NODEMAILER',
        idempotencyKey: cleanKey || undefined,
        metadata: { actorId, feedbackId },
      });
      await outbox.save();
    } else {
      outbox = {
        _id: new mongoose.Types.ObjectId(),
        recipient: recipient || 'no-email@petclinic.local',
        subject,
        content: message,
        targetType: 'FEEDBACK',
        targetId: feedbackId,
        status: 'QUEUED',
        provider: 'NODEMAILER',
        idempotencyKey: cleanKey || undefined,
        attempts: 0,
        lastError: null,
        sentAt: null,
        metadata: { actorId, feedbackId },
        save: async function () { return this; },
      };
      if (cleanKey) inMemoryOutboxStore.set(cleanKey, outbox);
    }
  }

  // 3. Simulated failure check ONLY in test environment (GAP-09)
  if (process.env.NODE_ENV === 'test' && forceFail) {
    outbox.status = 'FAILED';
    outbox.lastError = 'Simulated SMTP connection failure';
    outbox.attempts += 1;
    if (isDbConnected) await outbox.save();
    return {
      success: false,
      status: 'FAILED',
      error: outbox.lastError,
      outbox,
    };
  }

  // 4. Attempt sending via Transporter
  try {
    const transporter = getTransporter();
    const mailOptions = {
      from: config.smtp?.from || '"Dr. Pet Clinic Support" <support@drpets.vn>',
      to: recipient,
      subject,
      text: message,
      html: `<div style="font-family: sans-serif; line-height: 1.6;">
        <p>${message.replace(/\n/g, '<br/>')}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;"/>
        <p style="color: #666; font-size: 12px;">Dr. Pet Clinic &mdash; Đồng hành cùng sức khỏe thú cưng của bạn.</p>
      </div>`,
    };

    const info = await transporter.sendMail(mailOptions);
    const providerMessageId = info.messageId || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    outbox.status = 'SENT';
    outbox.providerMessageId = providerMessageId;
    outbox.sentAt = new Date();
    outbox.attempts += 1;
    outbox.lastError = null;
    if (isDbConnected) await outbox.save();

    logger.info(`[EmailOutbox] Feedback reply sent to ${recipient} (MessageId: ${providerMessageId})`);
    return {
      success: true,
      status: 'SENT',
      providerMessageId,
      outbox,
    };
  } catch (err) {
    logger.error(`[EmailOutbox] Failed sending feedback reply to ${recipient}: ${err.message}`);
    outbox.status = 'FAILED';
    outbox.lastError = err.message;
    outbox.attempts += 1;
    if (isDbConnected) await outbox.save();

    return {
      success: false,
      status: 'FAILED',
      error: err.message,
      outbox,
    };
  }
};

export default {
  sendFeedbackReplyEmail,
};
