import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function syncIndexes() {
  try {
    console.log('Connecting to MongoDB for index sync...');
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    console.log('Creating Users indexes...');
    await db.collection('users').createIndex({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } });
    await db.collection('users').createIndex({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: "string" } } });

    console.log('Creating Products indexes...');
    await db.collection('products').createIndex({ name: 'text', description: 'text' });
    await db.collection('products').createIndex({ status: 1, categoryId: 1, createdAt: -1 });
    await db.collection('products').createIndex({ status: 1, "variants.price": 1 });

    console.log('Creating Carts indexes...');
    await db.collection('carts').createIndex({ customerId: 1 }, { unique: true, partialFilterExpression: { customerId: { $exists: true } } });
    await db.collection('carts').createIndex({ tokenHash: 1 }, { unique: true, partialFilterExpression: { tokenHash: { $exists: true } } });
    await db.collection('carts').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    console.log('Creating Vouchers indexes...');
    await db.collection('vouchers').createIndex({ code: 1 }, { unique: true });
    await db.collection('voucher_usages').createIndex({ voucherId: 1, targetType: 1, targetId: 1 }, { unique: true });

    console.log('Creating Orders indexes...');
    await db.collection('orders').createIndex({ customerId: 1, createdAt: -1 });
    await db.collection('orders').createIndex({ fulfillmentBranchId: 1, status: 1, createdAt: -1 });
    await db.collection('orders').createIndex({ code: 1 }, { unique: true });

    console.log('Creating OrderRefunds & OrderReturns indexes...');
    await db.collection('order_refunds').createIndex({ orderReturnId: 1 }, { unique: true, partialFilterExpression: { orderReturnId: { $exists: true } } });
    
    console.log('Creating SlotReservations indexes...');
    await db.collection('slot_reservations').createIndex({ staffId: 1, slotStartUnit: 1 }, { unique: true, partialFilterExpression: { kind: 'STAFF', status: { $in: ['HELD', 'CONFIRMED'] } } });
    await db.collection('slot_reservations').createIndex({ branchId: 1, serviceId: 1, slotStartUnit: 1, unitIndex: 1 }, { unique: true, partialFilterExpression: { kind: 'CAPACITY', status: { $in: ['HELD', 'CONFIRMED'] } } });

    console.log('Creating Appointments indexes...');
    await db.collection('appointments').createIndex({ customerId: 1, scheduledStart: -1 });
    await db.collection('appointments').createIndex({ branchId: 1, scheduledStart: 1 });
    await db.collection('appointments').createIndex({ code: 1 }, { unique: true });
    
    console.log('Creating InventoryStocks & Transactions indexes...');
    await db.collection('inventory_stocks').createIndex({ branchId: 1, inventoryItemId: 1 }, { unique: true });
    await db.collection('inventory_transactions').createIndex(
      { sourceId: 1, inventoryItemId: 1, transactionType: 1 }, 
      { unique: true, partialFilterExpression: { sourceType: 'ORDER' } }
    );
    await db.collection('inventory_transactions').createIndex(
      { sourceId: 1, recordVersion: 1, inventoryItemId: 1 }, 
      { unique: true, partialFilterExpression: { sourceType: 'SERVICE_RECORD_REVISION' } }
    );

    console.log('Creating BookingRefunds indexes...');
    await db.collection('booking_refunds').createIndex(
      { paymentId: 1 }, 
      { unique: true, partialFilterExpression: { status: { $in: ['REQUESTED', 'PROCESSING', 'APPROVED', 'REFUNDED'] } } }
    );

    console.log('Index synchronization completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error syncing indexes:', error);
    process.exit(1);
  }
}

syncIndexes();
