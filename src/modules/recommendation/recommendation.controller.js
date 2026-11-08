import * as recommendationService from './recommendation.service';
import { sendSuccess } from '../../shared/responseHelpers';

export const getRecommendations = async (req, res, next) => {
  try {
    const result = await recommendationService.getRecommendations({
      petId: req.query.petId,
      type: req.query.type,
      categoryId: req.query.categoryId,
      need: req.query.need,
      branchId: req.query.branchId,
      limit: req.query.limit,
      actor: req.actor,
    });
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

