import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  // TODO: Implement fields for Review as per 05-mongodb-schema-v6.md
}, { timestamps: true });

export default mongoose.model('Review', schema);