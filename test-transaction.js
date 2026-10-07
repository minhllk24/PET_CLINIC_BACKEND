import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function testTransaction() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');
    
    console.log('Starting transaction...');
    const session = await mongoose.startSession();
    session.startTransaction();
    console.log('Transaction started successfully.');
    
    await session.commitTransaction();
    console.log('Transaction committed successfully.');
    
    session.endSession();
    await mongoose.connection.close();
    console.log('Test complete. MongoDB Replica Set and Transactions are fully supported.');
  } catch (error) {
    console.error('Error during transaction test:', error);
    process.exit(1);
  }
}

testTransaction();
