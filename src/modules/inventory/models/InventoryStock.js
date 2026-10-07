import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  // TODO: Implement fields for InventoryStock as per 05-mongodb-schema-v6.md
}, { timestamps: true });

export default mongoose.model('InventoryStock', schema);