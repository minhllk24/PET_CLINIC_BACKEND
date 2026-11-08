import * as screeningService from './screening.service';
import { sendSuccess } from '../../shared/responseHelpers';

export const screenSymptoms = async (req, res, next) => {
  try {
    const result = await screeningService.screenSymptoms({
      petId: req.body.petId,
      species: req.body.species,
      ageYears: req.body.ageYears,
      weightKg: req.body.weightKg,
      symptoms: req.body.symptoms,
      actor: req.actor,
    });
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

