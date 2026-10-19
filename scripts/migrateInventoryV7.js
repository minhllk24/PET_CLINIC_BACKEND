import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const apply = process.argv.includes('--apply');

const countDuplicateGroups = async (collection, match, keys) => {
  const [result] = await collection.aggregate([
    { $match: match },
    { $group: { _id: keys, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: 'groups' }
  ]).toArray();
  return result ? result.groups : 0;
};

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  await mongoose.connect(process.env.MONGODB_URI);

  const stocks = mongoose.connection.collection('inventorystocks');
  const transactions = mongoose.connection.collection('inventorytransactions');
  const idempotencyKeys = mongoose.connection.collection('idempotencykeys');
  const existingCollections = await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray();
  const hasIdempotencyCollection = existingCollections.some(({ name }) => name === 'idempotencykeys');
  const idempotencyIndexes = hasIdempotencyCollection ? await idempotencyKeys.indexes() : [];
  const legacyIdempotencyIndex = idempotencyIndexes.find((index) => (
    index.unique
    && JSON.stringify(index.key) === JSON.stringify({ actorScope: 1, key: 1 })
  ));
  const duplicateStockGroups = await countDuplicateGroups(
    stocks,
    {},
    { branchId: '$branchId', inventoryItemId: '$inventoryItemId' }
  );
  const duplicateOrderMovementGroups = await countDuplicateGroups(
    transactions,
    { sourceType: 'ORDER', sourceId: { $type: 'objectId' } },
    {
      sourceType: '$sourceType',
      sourceId: '$sourceId',
      inventoryItemId: '$inventoryItemId',
      transactionType: '$transactionType'
    }
  );
  const duplicateServiceMovementGroups = await countDuplicateGroups(
    transactions,
    { sourceType: 'SERVICE_RECORD_REVISION', sourceId: { $type: 'objectId' }, recordVersion: { $type: 'number' } },
    {
      sourceType: '$sourceType',
      sourceId: '$sourceId',
      recordVersion: '$recordVersion',
      inventoryItemId: '$inventoryItemId'
    }
  );
  const duplicateTransferLegGroups = await countDuplicateGroups(
    transactions,
    { transferId: { $type: 'objectId' }, transferLeg: { $type: 'string' } },
    { transferId: '$transferId', transferLeg: '$transferLeg' }
  );

  const report = {
    mode: apply ? 'APPLY' : 'DRY_RUN',
    legacyThresholdRows: await stocks.countDocuments({ threshold: { $exists: true } }),
    missingLowStockThresholdRows: await stocks.countDocuments({ lowStockThreshold: { $exists: false } }),
    missingVersionRows: await stocks.countDocuments({ version: { $exists: false } }),
    negativeStockRows: await stocks.countDocuments({ quantity: { $lt: 0 } }),
    invalidLedgerRows: await transactions.countDocuments({
      $or: [
        { beforeQty: { $exists: false } },
        { changeQty: { $exists: false } },
        { afterQty: { $exists: false } },
        { actorId: { $exists: false } },
        { reason: { $exists: false } }
      ]
    }),
    legacyIdempotencyIndex: legacyIdempotencyIndex ? legacyIdempotencyIndex.name : null,
    duplicateStockGroups,
    duplicateOrderMovementGroups,
    duplicateServiceMovementGroups,
    duplicateTransferLegGroups
  };

  if (apply) {
    if (report.negativeStockRows > 0) {
      throw new Error('Migration stopped: negative inventory rows require manual investigation');
    }
    if (
      duplicateStockGroups
      || duplicateOrderMovementGroups
      || duplicateServiceMovementGroups
      || duplicateTransferLegGroups
    ) {
      throw new Error('Migration stopped: duplicate inventory keys require manual investigation');
    }
    const result = await stocks.updateMany(
      {},
      [
        {
          $set: {
            lowStockThreshold: { $max: [{ $ifNull: ['$lowStockThreshold', { $ifNull: ['$threshold', 0] }] }, 0] },
            version: { $max: [{ $ifNull: ['$version', 1] }, 1] }
          }
        },
        { $unset: 'threshold' }
      ]
    );
    report.matchedRows = result.matchedCount;
    report.modifiedRows = result.modifiedCount;

    if (legacyIdempotencyIndex) {
      await idempotencyKeys.dropIndex(legacyIdempotencyIndex.name);
      report.droppedLegacyIdempotencyIndex = legacyIdempotencyIndex.name;
    }
    await idempotencyKeys.createIndex(
      { actorScope: 1, operationId: 1, key: 1 },
      { unique: true, name: 'actorScope_1_operationId_1_key_1' }
    );
    report.idempotencyIndexReady = true;

    await stocks.createIndex(
      { branchId: 1, inventoryItemId: 1 },
      { unique: true, name: 'branchId_1_inventoryItemId_1' }
    );
    await stocks.createIndex({ branchId: 1, quantity: 1 }, { name: 'branchId_1_quantity_1' });
    await transactions.createIndex(
      { sourceType: 1, sourceId: 1, inventoryItemId: 1, transactionType: 1 },
      {
        unique: true,
        name: 'sourceType_1_sourceId_1_inventoryItemId_1_transactionType_1',
        partialFilterExpression: { sourceType: 'ORDER', sourceId: { $type: 'objectId' } }
      }
    );
    await transactions.createIndex(
      { sourceType: 1, sourceId: 1, recordVersion: 1, inventoryItemId: 1 },
      {
        unique: true,
        name: 'sourceType_1_sourceId_1_recordVersion_1_inventoryItemId_1',
        partialFilterExpression: {
          sourceType: 'SERVICE_RECORD_REVISION',
          sourceId: { $type: 'objectId' },
          recordVersion: { $type: 'number' }
        }
      }
    );
    await transactions.createIndex(
      { transferId: 1, transferLeg: 1 },
      {
        unique: true,
        name: 'transferId_1_transferLeg_1',
        partialFilterExpression: { transferId: { $type: 'objectId' }, transferLeg: { $type: 'string' } }
      }
    );
    report.inventoryIndexesReady = true;
  }

  console.log(JSON.stringify(report, null, 2));
  console.log('No stock quantity or InventoryTransaction was inferred or synthesized.');
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
