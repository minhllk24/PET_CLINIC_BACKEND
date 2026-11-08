import mongoose from 'mongoose';
import Product from '../catalog/models/Product';
import Service from '../catalog/models/Service';
import Pet from '../customer/models/Pet';
import Order from '../order/models/Order';
import Appointment from '../booking/models/Appointment';
import BranchServiceConfig from '../branch/models/BranchServiceConfig';

export const getRecommendations = async ({
  petId = null,
  type = 'ALL',
  categoryId = null,
  need = null,
  branchId = null,
  limit = 10,
  actor = null,
} = {}) => {
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);

  let pet = null;
  if (petId && mongoose.Types.ObjectId.isValid(petId)) {
    pet = await Pet.findById(petId).lean();
  }

  const species = pet?.species ? String(pet.species).toUpperCase() : null;
  const ageYears = Number(pet?.ageYears || 2);
  const notes = String(pet?.medicalNotes || '').toLowerCase();
  const breed = String(pet?.breed || '').toLowerCase();

  // 1. Gather Purchase & Service History
  let pastServiceTypes = new Set();
  let pastProductCategories = new Set();
  if (pet?.customerId) {
    const [pastApts, pastOrders] = await Promise.all([
      Appointment.find({ petId: pet._id, status: 'COMPLETED' })
        .populate('service', 'serviceType category')
        .limit(20)
        .lean(),
      Order.find({ customerId: pet.customerId, status: { $in: ['COMPLETED', 'DELIVERED', 'PAID'] } })
        .limit(10)
        .lean(),
    ]);

    for (const apt of pastApts) {
      if (apt.serviceType) pastServiceTypes.add(apt.serviceType);
      if (apt.service?.serviceType) pastServiceTypes.add(apt.service.serviceType);
      if (apt.service?.category) pastServiceTypes.add(apt.service.category);
    }
    for (const ord of pastOrders) {
      for (const it of ord.items || []) {
        if (it.categoryId) pastProductCategories.add(it.categoryId.toString());
      }
    }
  }

  const candidateItems = [];

  // 2. Fetch Active In-Stock Products
  if (type === 'ALL' || type === 'PRODUCT') {
    const productQuery = {
      status: 'ACTIVE',
      usageType: { $in: ['SALE', 'SHARED'] },
    };
    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
      productQuery.categoryId = categoryId;
    }

    const products = await Product.find(productQuery)
      .populate('categoryId', 'name')
      .limit(60)
      .lean();

    for (const p of products) {
      // Hard filter: must have at least one variant with stock > 0
      const totalStock = (p.variants || []).reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
      if (totalStock <= 0) continue;

      let score = 20; // Base score
      const signals = [];
      const reasons = [];

      const pName = String(p.name || '').toLowerCase();
      const pDesc = String(p.description || '').toLowerCase();

      // Signal: Species Match
      if (species === 'DOG') {
        if (pName.includes('chó') || pDesc.includes('chó') || pName.includes('dog') || pName.includes('cún')) {
          score += 40;
          signals.push('SPECIES_MATCH');
          reasons.push('Thiết kế chuyên biệt cho chó');
        } else if (pName.includes('mèo') || pDesc.includes('mèo') || pName.includes('cat')) {
          score -= 30; // Mismatch
        }
      } else if (species === 'CAT') {
        if (pName.includes('mèo') || pDesc.includes('mèo') || pName.includes('cat')) {
          score += 40;
          signals.push('SPECIES_MATCH');
          reasons.push('Thiết kế chuyên biệt cho mèo');
        } else if (pName.includes('chó') || pDesc.includes('chó') || pName.includes('dog')) {
          score -= 30; // Mismatch
        }
      }

      // Signal: Age / Lifestage
      if (ageYears < 1) {
        if (pName.includes('con') || pName.includes('junior') || pName.includes('puppy') || pName.includes('kitten')) {
          score += 25;
          signals.push('LIFESTAGE_JUNIOR');
          reasons.push(`Dinh dưỡng tăng trưởng cho ${species === 'CAT' ? 'mèo con' : 'chó con'} dưới 1 tuổi`);
        }
      } else if (ageYears >= 7) {
        if (pName.includes('senior') || pName.includes('khớp') || pName.includes('lớn tuổi') || pName.includes('già')) {
          score += 25;
          signals.push('LIFESTAGE_SENIOR');
          reasons.push('Hỗ trợ xương khớp và đề kháng cho thú cưng lớn tuổi');
        }
      }

      // Signal: Health & Medical Notes
      if (notes.includes('sỏi') || notes.includes('thận') || notes.includes('urinary')) {
        if (pName.includes('urinary') || pName.includes('thận') || pDesc.includes('tiết niệu')) {
          score += 30;
          signals.push('SPECIALIZED_DIET');
          reasons.push('Hỗ trợ ngăn ngừa và hòa tan sỏi thận tiết niệu');
        }
      }
      if (notes.includes('da') || notes.includes('lông') || notes.includes('dị ứng')) {
        if (pName.includes('skin') || pName.includes('dưỡng lông') || pName.includes('hypoallergenic')) {
          score += 25;
          signals.push('DERMA_CARE');
          reasons.push('Dưỡng lông bóng mượt và giảm kích ứng da');
        }
      }

      // Signal: History
      if (p.categoryId && pastProductCategories.has(p.categoryId._id?.toString() || p.categoryId.toString())) {
        score += 15;
        signals.push('CATEGORY_REPURCHASE');
      }

      // Popularity rating bonus
      score += Math.min(Math.round((p.ratingAvg || 0) * 2), 10);

      if (reasons.length === 0) {
        reasons.push('Sản phẩm bán chạy được yêu thích tại phòng khám');
      }

      candidateItems.push({
        type: 'PRODUCT',
        score,
        reason: reasons.join(' • '),
        signals,
        item: {
          id: p._id.toString(),
          name: p.name,
          slug: p.slug,
          categoryName: p.categoryId?.name || 'Sản phẩm thú cưng',
          basePrice: p.basePrice || p.minPrice || p.variants?.[0]?.price || 0,
          ratingAvg: p.ratingAvg || 5,
          ratingCount: p.ratingCount || 0,
          images: p.images || [],
          inStock: true,
          totalStock,
        },
      });
    }
  }

  // 3. Fetch Active Services
  if (type === 'ALL' || type === 'SERVICE') {
    const services = await Service.find({ status: 'ACTIVE' }).limit(30).lean();

    // Check branch configs if branchId is supplied
    let branchServiceSet = null;
    if (branchId && mongoose.Types.ObjectId.isValid(branchId)) {
      const configs = await BranchServiceConfig.find({ branchId, enabled: true }).select('serviceId').lean();
      branchServiceSet = new Set(configs.map((c) => c.serviceId.toString()));
    }

    for (const s of services) {
      if (branchServiceSet && !branchServiceSet.has(s._id.toString())) {
        continue;
      }

      let score = 25; // Base score
      const signals = [];
      const reasons = [];

      const sName = String(s.name || '').toLowerCase();
      const sDesc = String(s.description || '').toLowerCase();

      // Check species context
      if (species) {
        score += 15;
        signals.push('PET_PROFILE_MATCH');
      }

      // Specialization: Vaccine / Prevention
      if (s.code === 'MED02') {
        score += 35;
        signals.push('PREVENTATIVE_CARE');
        reasons.push('Phòng ngừa mầm bệnh truyền nhiễm định kỳ hàng năm');
      } else if (s.code === 'MED03') {
        score += 30;
        signals.push('PARASITE_CONTROL');
        reasons.push('Bảo vệ tiêu hóa khỏi giun sán và ve rận ký sinh');
      } else if (s.code === 'MED01') {
        score += 25;
        signals.push('WELLNESS_CHECK');
        reasons.push('Kiểm tra sức khỏe tổng thể và phát hiện sớm bất thường');
      } else if (s.serviceType === 'GROOMING') {
        if (breed.includes('poodle') || breed.includes('golden') || breed.includes('corgi') || notes.includes('lông dày')) {
          score += 35;
          signals.push('BREED_GROOMING_FIT');
          reasons.push(`Đặc biệt khuyên dùng cho giống ${pet?.breed || 'lông dài'} giúp lông tơi bông và sạch sẽ`);
        } else {
          score += 20;
          reasons.push('Chăm sóc vệ sinh spa làm đẹp và khử mùi hôi cơ thể');
        }
      }

      if (pastServiceTypes.has(s.serviceType)) {
        score += 15;
        signals.push('SERVICE_LOYALTY');
      }

      if (reasons.length === 0) {
        reasons.push('Dịch vụ được đặt nhiều nhất bởi khách hàng');
      }

      candidateItems.push({
        type: 'SERVICE',
        score,
        reason: reasons.join(' • '),
        signals,
        item: {
          id: s._id.toString(),
          code: s.code,
          name: s.name,
          serviceType: s.serviceType,
          category: s.category,
          basePrice: s.basePrice,
          durationMinutes: s.durationMinutes,
          bookingMode: s.bookingMode,
          ratingAvg: s.ratingAvg || 5,
        },
      });
    }
  }

  // 4. Sort Candidates Deterministically
  candidateItems.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.item.ratingAvg || 0) - (a.item.ratingAvg || 0);
  });

  const results = candidateItems.slice(0, parsedLimit);

  return {
    petId: pet?._id ? pet._id.toString() : null,
    petName: pet?.name || null,
    totalRecommendations: results.length,
    recommendations: results,
  };
};

export default {
  getRecommendations,
};

