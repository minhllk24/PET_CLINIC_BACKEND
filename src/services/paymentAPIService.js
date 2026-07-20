import prisma from '../configs/prisma';
import { toBigIntId } from '../utils/prismaHelpers';

const getAllPayments = async (query) => {
  try {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;

    const [total, payments] = await prisma.$transaction([
      prisma.payment.count(),
      prisma.payment.findMany({
        skip,
        take: limit,
        orderBy: { created_at: 'desc' }
      })
    ]);

    return {
      EM: 'Get payments successful',
      EC: 0,
      DT: {
        totalRows: total,
        totalPages: Math.ceil(total / limit),
        payments
      }
    };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const updatePaymentStatus = async (id, status) => {
  try {
    const paymentId = toBigIntId(id);
    if (!paymentId) return { EM: 'Invalid payment ID', EC: 1, DT: '' };

    const validStatuses = ['pending', 'waiting_store_payment', 'paid', 'failed', 'refunded', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return { EM: 'Invalid status', EC: 1, DT: '' };
    }

    const payment = await prisma.payment.findUnique({ where: { payment_id: paymentId } });
    if (!payment) return { EM: 'Payment not found', EC: -1, DT: '' };

    // Transaction to update both Payment and Order/Appointment if needed
    const result = await prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { payment_id: paymentId },
        data: { status: status }
      });

      if (payment.payment_target_type === 'order' && status === 'paid') {
        await tx.order.update({
          where: { order_id: payment.order_id },
          data: { payment_status: 'paid' }
        });
      }
      return updatedPayment;
    });

    return { EM: 'Update payment status successful', EC: 0, DT: result };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

module.exports = {
  getAllPayments,
  updatePaymentStatus
};
