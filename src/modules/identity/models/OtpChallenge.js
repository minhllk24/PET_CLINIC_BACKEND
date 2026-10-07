import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  // TODO: Implement fields for OtpChallenge as per 05-mongodb-schema-v6.md
}, { timestamps: true });

export default mongoose.model('OtpChallenge', schema);