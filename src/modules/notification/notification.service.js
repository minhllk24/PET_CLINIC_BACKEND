import OutboxMessage from './models/OutboxMessage';

export const sendEmail = async (to, subject, body, session = null) => {
  const msg = new OutboxMessage({
    type: 'EMAIL',
    payload: { to, subject, body }
  });
  if (session) {
    await msg.save({ session });
  } else {
    await msg.save();
  }
  return msg;
};

export const sendSms = async (to, message, session = null) => {
  const msg = new OutboxMessage({
    type: 'SMS',
    payload: { to, message }
  });
  if (session) {
    await msg.save({ session });
  } else {
    await msg.save();
  }
  return msg;
};
