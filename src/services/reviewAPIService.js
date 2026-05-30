import prisma from '../configs/prisma';
import { toBigIntId } from '../utils/prismaHelpers';

const getReviewsByTarget = async (targetType, targetIdStr, query) => {
  try {
    const targetId = toBigIntId(targetIdStr);
    if (!targetId) return { EM: 'Invalid target ID', EC: 1, DT: '' };

    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;

    const whereCondition = {
      target_type: targetType,
      target_id: targetId,
      status: 'posted'
    };

    const [total, reviews] = await prisma.$transaction([
      prisma.review.count({ where: whereCondition }),
      prisma.review.findMany({
        where: whereCondition,
        include: {
          user: { select: { full_name: true, avatar_url: true } },
          images: true
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' }
      })
    ]);

    return {
      EM: 'Get reviews successful',
      EC: 0,
      DT: {
        totalRows: total,
        totalPages: Math.ceil(total / limit),
        reviews
      }
    };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const createReview = async (userIdStr, data) => {
  try {
    const userId = toBigIntId(userIdStr);
    const { target_type, target_id, rating, comment, images } = data;

    if (!target_type || !target_id || !rating) {
      return { EM: 'Missing required fields', EC: 1, DT: '' };
    }

    const targetIdBig = toBigIntId(target_id);

    const newReview = await prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          user_id: userId,
          target_type,
          target_id: targetIdBig,
          rating: parseInt(rating),
          comment: comment || null,
          status: 'posted'
        }
      });

      if (images && Array.isArray(images)) {
        const imgData = images.map(url => ({
          review_id: review.review_id,
          image_url: url
        }));
        await tx.reviewImage.createMany({ data: imgData });
      }

      // Update average rating
      const allReviews = await tx.review.findMany({
        where: { target_type, target_id: targetIdBig, status: 'posted' },
        select: { rating: true }
      });

      const avgRating = allReviews.reduce((acc, curr) => acc + curr.rating, 0) / allReviews.length;

      if (target_type === 'product') {
        await tx.product.update({
          where: { product_id: targetIdBig },
          data: { average_rating: avgRating }
        });
      } else if (target_type === 'service') {
        await tx.clinicService.update({
          where: { service_id: targetIdBig },
          data: { average_rating: avgRating }
        });
      }

      return review;
    });

    return { EM: 'Create review successful', EC: 0, DT: newReview };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const updateReviewStatus = async (id, status) => {
  try {
    const reviewId = toBigIntId(id);
    if (!reviewId) return { EM: 'Invalid ID', EC: 1, DT: '' };

    const review = await prisma.review.findUnique({ where: { review_id: reviewId } });
    if (!review) return { EM: 'Review not found', EC: -1, DT: '' };

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.review.update({
        where: { review_id: reviewId },
        data: { status }
      });

      // Recalculate avg rating if status changes from or to 'posted'
      const allReviews = await tx.review.findMany({
        where: { target_type: review.target_type, target_id: review.target_id, status: 'posted' },
        select: { rating: true }
      });

      const avgRating = allReviews.length > 0 
        ? allReviews.reduce((acc, curr) => acc + curr.rating, 0) / allReviews.length 
        : 0;

      if (review.target_type === 'product') {
        await tx.product.update({
          where: { product_id: review.target_id },
          data: { average_rating: avgRating }
        });
      } else if (review.target_type === 'service') {
        await tx.clinicService.update({
          where: { service_id: review.target_id },
          data: { average_rating: avgRating }
        });
      }

      return updated;
    });

    return { EM: 'Update review status successful', EC: 0, DT: result };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const getAllReviews = async (query) => {
  try {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.pageSize) || parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;

    const whereCondition = {
      status: 'posted'
    };

    const [total, reviews] = await prisma.$transaction([
      prisma.review.count({ where: whereCondition }),
      prisma.review.findMany({
        where: whereCondition,
        include: {
          user: { select: { full_name: true, avatar_url: true } },
          images: true
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' }
      })
    ]);

    return {
      EM: 'Get all reviews successful',
      EC: 0,
      DT: {
        totalRows: total,
        totalPages: Math.ceil(total / limit),
        reviews
      }
    };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

module.exports = {
  getReviewsByTarget,
  getAllReviews,
  createReview,
  updateReviewStatus
};
