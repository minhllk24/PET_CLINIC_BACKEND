import mongoose from 'mongoose';
import OutboxMessage from '../modules/notification/models/OutboxMessage';

export const processOutbox = async () => {
  const messages = await OutboxMessage.find({
    status: 'PENDING',
    nextAttemptAt: { $lte: new Date() }
  }).limit(50);

  for (const msg of messages) {
    msg.status = 'PROCESSING';
    await msg.save();

    try {
      // Mock sending logic
      console.log(`Sending ${msg.type} to ${msg.payload.to}`);
      
      msg.status = 'COMPLETED';
      await msg.save();
    } catch (error) {
      msg.attempts += 1;
      if (msg.attempts >= 3) {
        msg.status = 'FAILED';
      } else {
        msg.status = 'PENDING';
        msg.nextAttemptAt = new Date(Date.now() + 5 * 60000); // retry in 5 mins
      }
      msg.error = error.message;
      await msg.save();
    }
  }
};
