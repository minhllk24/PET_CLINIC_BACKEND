import mongoose from 'mongoose';
import Pet from '../customer/models/Pet';
import Service from '../catalog/models/Service';
import Post from '../content/models/Post';
import { evaluateDeterministicTriage, EMERGENCY_KEYWORDS, VET_DISCLAIMER } from './triageRules';
import { callGeminiTriage } from './geminiClient';
import AppError from '../../utils/AppError';

export const screenSymptoms = async ({
  petId = null,
  species = 'DOG',
  ageYears = null,
  weightKg = null,
  symptoms = '',
  actor = null,
} = {}) => {
  if (!symptoms || typeof symptoms !== 'string' || symptoms.trim().length === 0) {
    throw new AppError(400, 'Bad Request', 'SYMPTOMS_REQUIRED', 'Vui lòng nhập mô tả triệu chứng của thú cưng');
  }

  const cleanSymptoms = symptoms.trim();
  let resolvedSpecies = species;
  let resolvedAge = ageYears;
  let resolvedWeight = weightKg;
  let petName = null;

  if (petId && mongoose.Types.ObjectId.isValid(petId)) {
    const pet = await Pet.findById(petId).lean();
    if (pet) {
      resolvedSpecies = pet.species || resolvedSpecies;
      resolvedAge = pet.ageYears !== undefined ? pet.ageYears : resolvedAge;
      resolvedWeight = pet.weightKg !== undefined ? pet.weightKg : resolvedWeight;
      petName = pet.name;
    }
  }

  // 1. Red-flag Check: If symptoms contain critical emergency keywords, bypass AI for instant safety
  const textLower = cleanSymptoms.toLowerCase();
  const isDirectEmergency = EMERGENCY_KEYWORDS.some((kw) => textLower.includes(kw));

  let triageResult = null;
  let mode = 'AI_ASSISTED';

  if (isDirectEmergency) {
    triageResult = evaluateDeterministicTriage({ species: resolvedSpecies, symptoms: cleanSymptoms });
    mode = 'EMERGENCY_OVERRIDE';
  } else {
    // 2. Try Gemini AI with 6s timeout
    const aiOutput = await callGeminiTriage({
      species: resolvedSpecies,
      ageYears: resolvedAge,
      weightKg: resolvedWeight,
      symptoms: cleanSymptoms,
    });

    if (aiOutput && aiOutput.attentionLevel && Array.isArray(aiOutput.nextSteps)) {
      triageResult = aiOutput;
      mode = 'AI_ASSISTED';
    } else {
      // 3. Fallback to Deterministic Matrix
      triageResult = evaluateDeterministicTriage({ species: resolvedSpecies, symptoms: cleanSymptoms });
      mode = 'DETERMINISTIC_FALLBACK';
    }
  }

  // 4. Enrich with real Services from MongoDB
  const serviceCodes = Array.isArray(triageResult.recommendedServiceCodes)
    ? triageResult.recommendedServiceCodes
    : ['MED01'];

  const services = await Service.find({
    code: { $in: serviceCodes },
    status: 'ACTIVE',
  })
    .select('code name serviceType category basePrice durationMinutes bookingMode')
    .lean();

  // 5. Enrich with real Articles from MongoDB
  const articleQuery = {
    status: 'PUBLISHED',
  };
  const articles = await Post.find(articleQuery)
    .select('title slug excerpt coverImage')
    .limit(3)
    .lean();

  return {
    petId: petId || null,
    petName: petName || null,
    species: resolvedSpecies,
    mode,
    attentionLevel: triageResult.attentionLevel || 'MEDIUM',
    attentionLabel: triageResult.attentionLabel || 'Cần theo dõi',
    summary: triageResult.summary || 'Đã phân tích các triệu chứng được cung cấp.',
    possibleCauses: triageResult.possibleCauses || [],
    nextSteps: triageResult.nextSteps || [],
    recommendedServices: services.map((s) => ({
      id: s._id.toString(),
      code: s.code,
      name: s.name,
      serviceType: s.serviceType,
      category: s.category,
      basePrice: s.basePrice,
      durationMinutes: s.durationMinutes,
      bookingMode: s.bookingMode,
    })),
    recommendedArticles: articles.map((a) => ({
      id: a._id.toString(),
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt,
      coverImage: a.coverImage,
    })),
    disclaimer: VET_DISCLAIMER,
  };
};

export default {
  screenSymptoms,
};

