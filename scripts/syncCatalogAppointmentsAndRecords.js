import 'dotenv/config';
import mongoose from 'mongoose';
import config from '../src/shared/config';
import Branch from '../src/modules/branch/models/Branch';
import Service from '../src/modules/catalog/models/Service';
import Product from '../src/modules/catalog/models/Product';
import Pet from '../src/modules/customer/models/Pet';
import Customer from '../src/modules/customer/models/Customer';
import GuestContact from '../src/modules/customer/models/GuestContact';
import StaffProfile from '../src/modules/staff/models/StaffProfile';
import User from '../src/models/User';
import Appointment from '../src/modules/booking/models/Appointment';
import ServiceRecord from '../src/modules/execution/models/ServiceRecord';
import InventoryItem from '../src/modules/inventory/models/InventoryItem';
import InventoryStock from '../src/modules/inventory/models/InventoryStock';
import InventoryTransaction from '../src/modules/inventory/models/InventoryTransaction';
import { resolveServiceWeightPricing } from '../src/modules/catalog/serviceCatalog.service';
import { buildPlannedMaterialsFromServices } from '../src/modules/execution/execution.helpers';

const run = async () => {
  await mongoose.connect(config.mongoUri);
  console.log('[Sync] Connected to MongoDB:', String(config.mongoUri).replace(/\/\/[^@]+@/, '//***@'));

  // 1. Backfill missing InventoryItem.usageType on legacy products/materials
  const products = await Product.find({}).select('variants.inventoryItemId usageType').lean();
  const productUsageMap = new Map();
  for (const p of products) {
    for (const v of p.variants || []) {
      if (v.inventoryItemId) {
        productUsageMap.set(v.inventoryItemId.toString(), p.usageType || 'SALE');
      }
    }
  }

  const invItemsMissingUsage = await InventoryItem.find({
    $or: [{ usageType: { $exists: false } }, { usageType: null }],
  }).lean();
  let backfilledItems = 0;
  for (const item of invItemsMissingUsage) {
    const inferred =
      item.kind === 'MATERIAL'
        ? 'SERVICE_SUPPLY'
        : (productUsageMap.get(item._id.toString()) || 'SALE');
    await InventoryItem.updateOne({ _id: item._id }, { $set: { usageType: inferred } });
    backfilledItems += 1;
  }
  console.log(`[Sync] Backfilled InventoryItem.usageType on ${backfilledItems} items.`);

  // 2. Ensure positive InventoryStock across all active branches for all active MATERIAL items
  const branches = await Branch.find({ status: 'ACTIVE' }).lean();
  const branchMap = new Map(branches.map((b) => [b._id.toString(), b]));
  const activeMaterials = await InventoryItem.find({ kind: 'MATERIAL', status: 'ACTIVE' }).lean();
  const materialBySku = new Map(activeMaterials.map((m) => [m.sku, m]));
  const materialById = new Map(activeMaterials.map((m) => [m._id.toString(), m]));

  let ensuredStocks = 0;
  for (const br of branches) {
    for (const mat of activeMaterials) {
      const existing = await InventoryStock.findOne({ branchId: br._id, inventoryItemId: mat._id }).lean();
      if (!existing || existing.quantity < 50) {
        await InventoryStock.findOneAndUpdate(
          { branchId: br._id, inventoryItemId: mat._id },
          {
            $set: {
              quantity: Math.max(500, existing?.quantity || 0),
              lowStockThreshold: existing?.lowStockThreshold || 20,
              thresholdConfigured: true,
            },
            $setOnInsert: { version: 1 },
          },
          { upsert: true }
        );
        ensuredStocks += 1;
      }
    }
  }
  console.log(`[Sync] Ensured positive stock across ${branches.length} branches for ${activeMaterials.length} materials (${ensuredStocks} updated).`);

  // 3. Synchronize ALL Appointments with canonical 19-service catalog
  const services = await Service.find({}).lean();
  const serviceById = new Map(services.map((s) => [s._id.toString(), s]));
  const serviceByCode = new Map(services.map((s) => [s.code, s]));

  const appointments = await Appointment.find({});
  let updatedAppointments = 0;
  for (const apt of appointments) {
    let dirty = false;
    const isPastOrActiveExecution = ['IN_PROGRESS', 'COMPLETED'].includes(apt.status);

    if (isPastOrActiveExecution && apt.checkInStatus !== 'ARRIVED') {
      apt.checkInStatus = 'ARRIVED';
      apt.checkedInAt = apt.checkedInAt || apt.scheduledStart || new Date();
      dirty = true;
    }

    // Clear stale cancel payload on non-cancelled appointments
    if (apt.status !== 'CANCELLED' && apt.cancel && (apt.cancel.by || apt.cancel.reason)) {
      apt.cancel = undefined;
      dirty = true;
    }

    const weightKg = apt.petSnapshot?.weightKg ?? null;
    let totalSubtotal = 0;
    let totalDuration = 0;
    const segTypes = new Set();

    for (const seg of apt.services || []) {
      const cat = seg.serviceId ? serviceById.get(seg.serviceId.toString()) : null;
      if (!cat) continue;

      if (seg.serviceName !== cat.name) {
        seg.serviceName = cat.name;
        dirty = true;
      }
      if (seg.serviceType !== cat.serviceType) {
        seg.serviceType = cat.serviceType;
        dirty = true;
      }
      if (seg.requiredStaffRole !== cat.requiredStaffRole) {
        seg.requiredStaffRole = cat.requiredStaffRole;
        dirty = true;
      }
      if (cat.bookingMode && seg.bookingMode !== cat.bookingMode) {
        seg.bookingMode = cat.bookingMode;
        dirty = true;
      }

      if (isPastOrActiveExecution && seg.checkInStatus !== 'ARRIVED') {
        seg.checkInStatus = 'ARRIVED';
        seg.checkedInAt = seg.checkedInAt || apt.checkedInAt || apt.scheduledStart || new Date();
        dirty = true;
      }

      // Realign canonical price & duration for non-cancelled/legacy mismatched snapshots
      const isSeededApt = typeof apt.code === 'string' && /^APT-202610/i.test(apt.code);
      if (isSeededApt) {
        const resolved = resolveServiceWeightPricing(cat, weightKg);
        const canonicalPrice =
          resolved.price !== null && resolved.price !== undefined
            ? Number(resolved.price)
            : Number(cat.basePrice || seg.unitPrice || 0);
        if (Number(seg.unitPrice) !== canonicalPrice) {
          seg.unitPrice = canonicalPrice;
          dirty = true;
        }
        if (resolved.variantLabel && seg.variantLabel !== resolved.variantLabel) {
          seg.variantLabel = resolved.variantLabel;
          dirty = true;
        }
        if (Number(seg.durationMinutes) !== Number(cat.durationMinutes)) {
          seg.durationMinutes = Number(cat.durationMinutes);
          dirty = true;
        }
      }

      // Fix APT-20261026-0002 Nurse segment whose ServiceRecord is already WAITING_VET_REVIEW
      if (apt.code === 'APT-20261026-0002' && seg.executionStatus !== 'COMPLETED') {
        seg.executionStatus = 'COMPLETED';
        seg.executionCompletedAt = seg.executionCompletedAt || new Date();
        dirty = true;
      }

      totalSubtotal += Number(seg.unitPrice || 0);
      totalDuration += Number(seg.durationMinutes || 0);
      segTypes.add(seg.serviceType || cat.serviceType);
    }

    if (typeof apt.code === 'string' && /^APT-202610/i.test(apt.code) && apt.services.length > 0) {
      if (totalDuration > 0 && apt.scheduledDurationMinutes !== totalDuration) {
        apt.scheduledDurationMinutes = totalDuration;
        dirty = true;
      }
      if (apt.pricing && Number(apt.pricing.subtotal) !== totalSubtotal) {
        const discount = Number(apt.pricing.voucherDiscount || 0);
        const finalAmount = Math.max(0, totalSubtotal - discount);
        apt.pricing.subtotal = totalSubtotal;
        apt.pricing.finalAmount = finalAmount;
        if (apt.status === 'COMPLETED') {
          apt.pricing.paidAmount = finalAmount;
          apt.pricing.balanceAmount = 0;
        } else {
          const paid = Number(apt.pricing.paidAmount || 0);
          apt.pricing.balanceAmount = Math.max(0, finalAmount - paid);
        }
        dirty = true;
      }
    }

    if (segTypes.size === 1) {
      const onlyType = [...segTypes][0];
      if (apt.serviceType !== onlyType) {
        apt.serviceType = onlyType;
        dirty = true;
      }
    }

    if (dirty) {
      await apt.save();
      updatedAppointments += 1;
    }
  }
  console.log(`[Sync] Updated ${updatedAppointments} appointments to match canonical catalog.`);

  // 4. Clean up orphaned invalid FINALIZED SR on CANCELLED appointment APT-20261025-0001
  const db = mongoose.connection.db;
  const cancelledApt = await Appointment.findOne({ code: 'APT-20261025-0001', status: 'CANCELLED' }).lean();
  if (cancelledApt) {
    const orphanDelete = await db.collection('servicerecords').deleteMany({
      appointmentId: cancelledApt._id,
      $or: [{ code: { $exists: false } }, { code: null }],
    });
    if (orphanDelete.deletedCount > 0) {
      console.log(`[Sync] Removed ${orphanDelete.deletedCount} orphaned invalid ServiceRecord(s) attached to CANCELLED APT-20261025-0001.`);
    }
  }

  // 5. Repair existing ServiceRecords (replace non-material PRODUCT items, populate plannedMaterials & notes, sync InventoryTransactions)
  const existingRecords = await ServiceRecord.find({});
  let repairedRecords = 0;
  for (const sr of existingRecords) {
    const apt = await Appointment.findById(sr.appointmentId).lean();
    if (!sr.code && apt?.code) {
      sr.code = apt.code.replace(/^APT-/i, 'SR-');
    }
    const planned = await buildPlannedMaterialsFromServices(sr.serviceIds || []);
    sr.plannedMaterials = planned;

    // Check if any actualMaterials reference non-material PRODUCT (e.g., RC-FIT32-2KG) or empty for active records
    const hasInvalidActual = (sr.actualMaterials || []).some(
      (m) => !m.inventoryItemId || !materialById.has(m.inventoryItemId.toString())
    );

    if (sr.code === 'SR-20261026-0002') {
      const bandage = materialBySku.get('MAT009');
      sr.actualMaterials = planned.map((p) => {
        if (bandage && p.inventoryItemId.toString() === bandage._id.toString()) {
          return {
            inventoryItemId: p.inventoryItemId,
            quantity: 2,
            unit: p.unit,
            notes: 'Dùng thêm băng cuộn cố định vết thương vùng cổ',
            isDefault: true,
            isExtra: false,
          };
        }
        return {
          inventoryItemId: p.inventoryItemId,
          quantity: p.quantity,
          unit: p.unit,
          notes: p.notes || 'Vật tư chuẩn theo định mức thay băng',
          isDefault: true,
          isExtra: false,
        };
      });
    } else if (hasInvalidActual || ((sr.actualMaterials || []).length === 0 && planned.length > 0)) {
      sr.actualMaterials = planned.map((p) => ({
        inventoryItemId: p.inventoryItemId,
        quantity: p.quantity,
        unit: p.unit,
        notes: p.notes || 'Vật tư tiêu hao thực tế theo định mức dịch vụ',
        isDefault: true,
        isExtra: false,
      }));
    }

    if (sr.code === 'SR-20261029-0005') {
      sr.professional = {
        ...(sr.professional || {}),
        diagnosis: sr.professional?.diagnosis || 'Viêm da dị ứng nhẹ vùng cổ, đã xử lý sát trùng và kê thuốc bôi.',
        treatment: sr.professional?.treatment || 'Bôi dung dịch sát trùng Betadine 2 lần/ngày, uống vitamin dưỡng lông trong 7 ngày.',
        result: sr.professional?.result || 'Tình trạng ổn định, thú cưng ăn uống bình thường.',
        professionalNote: sr.professional?.professionalNote || 'Tái khám sau 7 ngày nếu vùng da chưa phục hồi hoàn toàn.',
      };
      sr.lastFinalizedActual = (sr.actualMaterials || []).map((m) => ({
        inventoryItemId: m.inventoryItemId,
        quantity: m.quantity,
        unit: m.unit,
        notes: m.notes || null,
        isDefault: Boolean(m.isDefault),
        isExtra: Boolean(m.isExtra),
      }));
    }

    await sr.save();
    repairedRecords += 1;

    // Repair broken seed InventoryTransaction on FINALIZED SR-20261029-0005 if pointing to PRODUCT RC-FIT32-2KG
    if (sr.status === 'FINALIZED' && sr.code === 'SR-20261029-0005' && (sr.actualMaterials || []).length > 0) {
      const mat0 = sr.actualMaterials[0];
      const matInfo = materialById.get(mat0.inventoryItemId.toString());
      const brInfo = branchMap.get(sr.branchId.toString());
      const st = await InventoryStock.findOne({ branchId: sr.branchId, inventoryItemId: mat0.inventoryItemId }).lean();
      const afterQty = Math.max(0, Number(st?.quantity ?? 500) - Number(mat0.quantity || 1));
      await InventoryStock.updateOne(
        { branchId: sr.branchId, inventoryItemId: mat0.inventoryItemId },
        { $set: { quantity: afterQty }, $inc: { version: 1 } }
      );
      const beforeQty = afterQty + Number(mat0.quantity || 1);
      const existingTxn = await db.collection('inventorytransactions').findOne({
        sourceType: { $in: ['SERVICE_RECORD', 'SERVICE_RECORD_REVISION'] },
        sourceId: sr._id,
      });
      const txnPayload = {
        branchId: sr.branchId,
        branchName: brInfo?.name || 'Chi nhánh Quận 1',
        branchCode: brInfo?.code || 'BR-000001',
        inventoryItemId: mat0.inventoryItemId,
        transactionType: 'ISSUE',
        beforeQty,
        changeQty: -Number(mat0.quantity || 1),
        afterQty,
        sourceType: 'SERVICE_RECORD',
        sourceId: sr._id,
        referenceCode: sr.code,
        recordVersion: sr.recordVersion || 1,
        actorName: 'Nguyễn Văn An',
        actorRole: 'STAFF',
        items: sr.actualMaterials.map((m) => {
          const info = materialById.get(m.inventoryItemId.toString());
          return {
            inventoryItemId: m.inventoryItemId.toString(),
            sku: info?.sku || null,
            name: info?.name || null,
            unit: m.unit,
            quantity: m.quantity,
            beforeQty,
            changeQty: -m.quantity,
            afterQty,
          };
        }),
        reason: `Xuất vật tư tiêu hao hồ sơ dịch vụ ${sr.code}`,
      };
      if (existingTxn) {
        await db.collection('inventorytransactions').updateOne({ _id: existingTxn._id }, { $set: txnPayload });
      } else {
        await InventoryTransaction.create({
          ...txnPayload,
          actorId: sr.reviewerStaffId || sr.assignedStaffIds[0] || new mongoose.Types.ObjectId('000000000000000000000000'),
        });
      }
    }
  }
  console.log(`[Sync] Repaired ${repairedRecords} existing ServiceRecords.`);

  // 6. Create ServiceRecord for existing IN_PROGRESS APT-20261031-0009 (missing ServiceRecord) + 2 fresh canonical Appointments & ServiceRecords
  const br1 = branches.find((b) => b.code === 'BR-000001') || branches[0];
  const findStaff = async (subRole) => {
    const emailUsers = await User.find({
      systemRole: 'STAFF',
      accountStatus: 'ACTIVE',
      email: /@drpetshouse\.vn$/i,
    }).select('_id fullName email').lean();
    if (emailUsers.length > 0) {
      const sp = await StaffProfile.findOne({
        staffSubRole: subRole,
        status: 'ACTIVE',
        authorizedBranchIds: br1._id,
        userId: { $in: emailUsers.map((u) => u._id) },
      }).lean();
      if (sp) return sp;
    }
    const users = await User.find({ systemRole: 'STAFF', accountStatus: 'ACTIVE' }).select('_id fullName').lean();
    const userIds = users.map((u) => u._id);
    return StaffProfile.findOne({
      staffSubRole: subRole,
      status: 'ACTIVE',
      authorizedBranchIds: br1._id,
      userId: { $in: userIds },
    }).lean();
  };

  const vetProfile = await findStaff('VETERINARIAN');
  const nurseProfile = await findStaff('NURSE');
  const groomerProfile = await findStaff('CARE_STAFF_GROOMER');

  // 6a. Ensure APT-20261031-0009 (IN_PROGRESS Guest Grooming) has SR-20261031-0009
  const apt0009 = await Appointment.findOne({ code: 'APT-20261031-0009' }).lean();
  if (apt0009 && (apt0009.services || []).length > 0) {
    const existing0009 = await ServiceRecord.findOne({ appointmentId: apt0009._id }).lean();
    if (!existing0009) {
      const sIds = apt0009.services.map((s) => s.serviceId);
      const planned0009 = await buildPlannedMaterialsFromServices(sIds);
      await ServiceRecord.create({
        code: 'SR-20261031-0009',
        appointmentId: apt0009._id,
        branchId: apt0009.branchId,
        customerId: apt0009.customerId || null,
        petId: apt0009.petId || null,
        serviceIds: sIds,
        assignedStaffIds: apt0009.services.map((s) => s.assignedStaffId).filter(Boolean),
        recordType: 'GROOMING',
        status: 'IN_PROGRESS',
        plannedMaterials: planned0009,
        actualMaterials: planned0009,
        actualStartAt: apt0009.scheduledStart || new Date(),
        professional: {
          professionalNote: 'Đang thực hiện tắm & sấy khô cho bé Bông theo định mức chuẩn.',
        },
      });
      console.log('[Sync] Created missing ServiceRecord SR-20261031-0009 for APT-20261031-0009.');
    }
  }

  // 6b. Create 2 fresh canonical Appointments + ServiceRecords (1 COMPLETED/FINALIZED Grooming Combo CMB01, 1 IN_PROGRESS Medical MED03)
  const customerProfile = await Customer.findOne({}).lean();
  const pets = customerProfile ? await Pet.find({ customerId: customerProfile._id }).lean() : await Pet.find({}).lean();
  const petLuna = pets.find((p) => p.name === 'Luna') || pets[0];
  const petBuddy = pets.find((p) => p.name === 'Buddy') || pets[1] || pets[0];
  const custUser = customerProfile ? await User.findById(customerProfile.userId).lean() : null;

  const cmb01 = serviceByCode.get('CMB01');
  const med03 = serviceByCode.get('MED03');

  if (br1 && cmb01 && med03 && customerProfile && petLuna && petBuddy && groomerProfile && vetProfile) {
    // Fixture 1: COMPLETED CMB01 + FINALIZED SR-20261119-0001 with full BOM + 1 extra + real InventoryTransaction
    const cmbStart = new Date(Date.now() - 3 * 3600000);
    const cmbEnd = new Date(cmbStart.getTime() + cmb01.durationMinutes * 60000);
    const cmbPriceObj = resolveServiceWeightPricing(cmb01, petLuna.weightKg || 4.2);
    const cmbPrice = cmbPriceObj.price ?? cmb01.basePrice;

    const aptCmb = await Appointment.findOneAndUpdate(
      { code: 'APT-20261119-0001' },
      {
        $set: {
          code: 'APT-20261119-0001',
          customerId: customerProfile._id,
          petId: petLuna._id,
          branchId: br1._id,
          serviceType: 'GROOMING',
          checkInStatus: 'ARRIVED',
          checkedInAt: cmbStart,
          paymentMethod: 'PAY_AT_STORE',
          status: 'COMPLETED',
          completedAt: cmbEnd,
          scheduledStart: cmbStart,
          scheduledEnd: cmbEnd,
          scheduledDurationMinutes: cmb01.durationMinutes,
          contactSnapshot: {
            fullName: custUser?.fullName || 'Khách hàng UAT',
            phone: custUser?.phone || '0901234567',
            email: custUser?.email || 'customer@test.com',
          },
          petSnapshot: {
            name: petLuna.name,
            species: petLuna.species,
            breed: petLuna.breed || 'Mèo Anh lông ngắn',
            weightKg: petLuna.weightKg || 4.2,
          },
          services: [
            {
              serviceId: cmb01._id,
              serviceName: cmb01.name,
              serviceType: cmb01.serviceType,
              variantLabel: cmbPriceObj.variantLabel || 'XS (< 5 kg)',
              unitPrice: cmbPrice,
              durationMinutes: cmb01.durationMinutes,
              requiredStaffRole: cmb01.requiredStaffRole,
              bookingMode: cmb01.bookingMode,
              sequence: 1,
              scheduledStart: cmbStart,
              scheduledEnd: cmbEnd,
              assignedStaffId: groomerProfile._id,
              checkInStatus: 'ARRIVED',
              checkedInAt: cmbStart,
              executionStatus: 'COMPLETED',
              executionCompletedAt: cmbEnd,
            },
          ],
          pricing: {
            subtotal: cmbPrice,
            voucherDiscount: 0,
            finalAmount: cmbPrice,
            depositAmount: Math.round(cmbPrice * 0.3),
            paidAmount: cmbPrice,
            balanceAmount: 0,
          },
          deposit: { status: 'APPLIED' },
        },
      },
      { upsert: true, new: true }
    );

    const plannedCmb = await buildPlannedMaterialsFromServices([cmb01._id]);
    const antiseptic = materialBySku.get('MAT004');
    const actualCmb = plannedCmb.map((p) => ({
      ...p,
      notes: 'Vật tư chuẩn theo Combo Tắm 11 bước',
    }));
    if (antiseptic && !actualCmb.some((m) => m.inventoryItemId.toString() === antiseptic._id.toString())) {
      actualCmb.push({
        inventoryItemId: antiseptic._id,
        quantity: 5,
        unit: antiseptic.unit,
        notes: 'Phát sinh sát khuẩn nhẹ vùng đệm bàn chân',
        isDefault: false,
        isExtra: true,
      });
    }

    const srCmb = await ServiceRecord.findOneAndUpdate(
      { appointmentId: aptCmb._id },
      {
        $set: {
          code: 'SR-20261119-0001',
          appointmentId: aptCmb._id,
          branchId: br1._id,
          customerId: customerProfile._id,
          petId: petLuna._id,
          serviceIds: [cmb01._id],
          assignedStaffIds: [groomerProfile._id],
          recordType: 'GROOMING',
          status: 'FINALIZED',
          recordVersion: 1,
          actualStartAt: cmbStart,
          actualEndAt: cmbEnd,
          finalizedAt: cmbEnd,
          plannedMaterials: plannedCmb,
          actualMaterials: actualCmb,
          lastFinalizedActual: actualCmb,
          professional: {
            professionalNote: 'Hoàn tất Combo Tắm 11 bước, lông mượt và sạch ve bụi.',
          },
        },
      },
      { upsert: true, new: true }
    );

    const existingCmbTx = await db.collection('inventorytransactions').findOne({
      sourceType: 'SERVICE_RECORD',
      sourceId: srCmb._id,
    });
    if (!existingCmbTx && actualCmb.length > 0) {
      const txItems = [];
      for (const m of actualCmb) {
        const info = materialById.get(m.inventoryItemId.toString());
        const st = await InventoryStock.findOne({ branchId: br1._id, inventoryItemId: m.inventoryItemId }).lean();
        const beforeQty = Number(st?.quantity ?? 500);
        const afterQty = Math.max(0, beforeQty - Number(m.quantity || 0));
        await InventoryStock.updateOne(
          { branchId: br1._id, inventoryItemId: m.inventoryItemId },
          { $set: { quantity: afterQty }, $inc: { version: 1 } }
        );
        txItems.push({
          inventoryItemId: m.inventoryItemId.toString(),
          sku: info?.sku || null,
          name: info?.name || null,
          unit: m.unit,
          quantity: m.quantity,
          beforeQty,
          changeQty: -m.quantity,
          afterQty,
        });
      }
      const actorUser = await User.findById(groomerProfile.userId).select('fullName').lean();
      await InventoryTransaction.create({
        branchId: br1._id,
        branchName: br1.name,
        branchCode: br1.code,
        inventoryItemId: actualCmb[0].inventoryItemId,
        transactionType: 'ISSUE',
        beforeQty: txItems.reduce((s, l) => s + l.beforeQty, 0),
        changeQty: txItems.reduce((s, l) => s + l.changeQty, 0),
        afterQty: txItems.reduce((s, l) => s + l.afterQty, 0),
        sourceType: 'SERVICE_RECORD',
        sourceId: srCmb._id,
        referenceCode: srCmb.code,
        recordVersion: 1,
        actorId: groomerProfile.userId || groomerProfile._id,
        actorName: actorUser?.fullName || 'Phạm Quốc Đạt',
        actorRole: 'STAFF',
        items: txItems,
        reason: `Xuất vật tư tiêu hao hồ sơ dịch vụ ${srCmb.code}`,
      });
    }

    // Fixture 2: IN_PROGRESS MED03 (Xét nghiệm máu / Test nhanh) + SR-20261119-0002 IN_PROGRESS
    const medStart = new Date();
    const medEnd = new Date(medStart.getTime() + med03.durationMinutes * 60000);
    const aptMed = await Appointment.findOneAndUpdate(
      { code: 'APT-20261119-0002' },
      {
        $set: {
          code: 'APT-20261119-0002',
          customerId: customerProfile._id,
          petId: petBuddy._id,
          branchId: br1._id,
          serviceType: 'MEDICAL',
          checkInStatus: 'ARRIVED',
          checkedInAt: medStart,
          paymentMethod: 'PAY_AT_STORE',
          status: 'IN_PROGRESS',
          reviewerStaffId: vetProfile._id,
          scheduledStart: medStart,
          scheduledEnd: medEnd,
          scheduledDurationMinutes: med03.durationMinutes,
          contactSnapshot: {
            fullName: custUser?.fullName || 'Khách hàng UAT',
            phone: custUser?.phone || '0901234567',
            email: custUser?.email || 'customer@test.com',
          },
          petSnapshot: {
            name: petBuddy.name,
            species: petBuddy.species,
            breed: petBuddy.breed || 'Golden Retriever',
            weightKg: petBuddy.weightKg || 28,
          },
          services: [
            {
              serviceId: med03._id,
              serviceName: med03.name,
              serviceType: med03.serviceType,
              unitPrice: med03.basePrice,
              durationMinutes: med03.durationMinutes,
              requiredStaffRole: med03.requiredStaffRole,
              bookingMode: med03.bookingMode,
              sequence: 1,
              scheduledStart: medStart,
              scheduledEnd: medEnd,
              assignedStaffId: vetProfile._id,
              checkInStatus: 'ARRIVED',
              checkedInAt: medStart,
              executionStatus: 'IN_PROGRESS',
              executionStartedAt: medStart,
            },
          ],
          pricing: {
            subtotal: med03.basePrice,
            voucherDiscount: 0,
            finalAmount: med03.basePrice,
            depositAmount: Math.round(med03.basePrice * 0.3),
            paidAmount: Math.round(med03.basePrice * 0.3),
            balanceAmount: med03.basePrice - Math.round(med03.basePrice * 0.3),
          },
          deposit: { status: 'HELD' },
        },
      },
      { upsert: true, new: true }
    );

    const plannedMed = await buildPlannedMaterialsFromServices([med03._id]);
    await ServiceRecord.findOneAndUpdate(
      { appointmentId: aptMed._id },
      {
        $set: {
          code: 'SR-20261119-0002',
          appointmentId: aptMed._id,
          branchId: br1._id,
          customerId: customerProfile._id,
          petId: petBuddy._id,
          serviceIds: [med03._id],
          assignedStaffIds: [vetProfile._id],
          reviewerStaffId: vetProfile._id,
          recordType: 'MEDICAL',
          status: 'IN_PROGRESS',
          actualStartAt: medStart,
          plannedMaterials: plannedMed,
          actualMaterials: plannedMed.map((p) => ({
            ...p,
            notes: 'Vật tư lấy mẫu xét nghiệm máu theo định mức MED03',
          })),
          professional: {
            professionalNote: 'Đang lấy mẫu máu xét nghiệm sinh hóa & test nhanh.',
          },
        },
      },
      { upsert: true, new: true }
    );

    console.log('[Sync] Upserted canonical sample Appointments & ServiceRecords: APT-20261119-0001 / SR-20261119-0001 and APT-20261119-0002 / SR-20261119-0002.');
  } else {
    console.warn('[Sync] Skipped creating extra canonical sample fixtures because one of branch/service/customer/pet/staff references was not found.');
  }

  // Note: suppress unused nurseProfile warning cleanly
  if (nurseProfile) {
    console.log(`[Sync] Verified Nurse profile available: ${nurseProfile._id}`);
  }

  await mongoose.disconnect();
  console.log('[Sync] Done!');
};

run().catch((err) => {
  console.error('[Sync] Fatal error:', err);
  process.exit(1);
});
