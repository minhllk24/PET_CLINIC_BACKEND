/**
 * Rule-based Clinical Engine for Personalized Pet Care Plans
 * Complies with Priority P2 - Task 5.1
 */

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const buildPetCarePlan = ({ pet, appointments = [], serviceRecords = [], taskStates = [] }) => {
  const now = new Date();
  const species = String(pet.species || 'DOG').toUpperCase();
  const ageYears = Number(pet.ageYears || 1);
  const weightKg = Number(pet.weightKg || 5);
  const notes = String(pet.medicalNotes || '').toLowerCase();

  const isPuppyOrKitten = ageYears < 1;
  const isSenior = ageYears >= 7;

  // Build a lookup map of user task state overrides
  const stateMap = new Map();
  for (const st of taskStates) {
    stateMap.set(st.taskKey, st);
  }

  // Find last medical and grooming records
  const findLastServiceDate = (predicate) => {
    let latest = null;
    for (const sr of serviceRecords) {
      if (sr.actualEndAt || sr.createdAt) {
        const srDate = new Date(sr.actualEndAt || sr.createdAt);
        if (predicate(sr)) {
          if (!latest || srDate > latest) latest = srDate;
        }
      }
    }
    for (const apt of appointments) {
      if (apt.status === 'COMPLETED' && apt.startTime) {
        const aptDate = new Date(apt.startTime);
        if (predicate(apt)) {
          if (!latest || aptDate > latest) latest = aptDate;
        }
      }
    }
    return latest;
  };

  const lastVaccineDate = findLastServiceDate((item) => {
    const code = item.service?.code || item.serviceCode;
    const name = String(item.service?.name || item.serviceName || '').toLowerCase();
    return code === 'MED02' || name.includes('vaccine') || name.includes('tiêm');
  });

  const lastDewormingDate = findLastServiceDate((item) => {
    const code = item.service?.code || item.serviceCode;
    const name = String(item.service?.name || item.serviceName || '').toLowerCase();
    return code === 'MED03' || name.includes('giun') || name.includes('ký sinh');
  });

  const lastWellnessDate = findLastServiceDate((item) => {
    const code = item.service?.code || item.serviceCode;
    const name = String(item.service?.name || item.serviceName || '').toLowerCase();
    return code === 'MED01' || name.includes('tổng quát') || name.includes('khám');
  });

  const lastGroomingDate = findLastServiceDate((item) => {
    const type = item.serviceType || item.service?.serviceType;
    const name = String(item.service?.name || item.serviceName || '').toLowerCase();
    return type === 'GROOMING' || name.includes('tắm') || name.includes('spa');
  });

  // Calculate task status based on dueDate and completion state
  const evaluateStatus = (taskKey, dueDate) => {
    const st = stateMap.get(taskKey);
    if (st && st.completed) {
      return { status: 'COMPLETED', completed: true, completedAt: st.completedAt };
    }
    const diffDays = Math.round((dueDate.getTime() - now.getTime()) / ONE_DAY_MS);
    if (diffDays < 0) {
      return { status: 'OVERDUE', completed: false, completedAt: null };
    }
    if (diffDays <= 14) {
      return { status: 'DUE_SOON', completed: false, completedAt: null };
    }
    return { status: 'UPCOMING', completed: false, completedAt: null };
  };

  const tasks = [];

  // 1. VACCINATION TIMELINE
  const vaccineIntervalDays = isPuppyOrKitten ? 30 : 365;
  const vaccineDueDate = lastVaccineDate
    ? new Date(lastVaccineDate.getTime() + vaccineIntervalDays * ONE_DAY_MS)
    : new Date(now.getTime() - 2 * ONE_DAY_MS); // Overdue if never recorded

  const vaccineKey = isPuppyOrKitten ? 'VACCINE_CORE_SERIES' : 'VACCINE_ANNUAL_BOOSTER';
  const vaccineEval = evaluateStatus(vaccineKey, vaccineDueDate);
  tasks.push({
    taskKey: vaccineKey,
    category: 'VACCINATION',
    title: isPuppyOrKitten
      ? (species === 'CAT' ? 'Tiêm vaccine 4 bệnh mèo mũi nhắc lại' : 'Tiêm vaccine 7 bệnh chó mũi 2/3')
      : 'Tiêm vaccine nhắc lại định kỳ hàng năm',
    description: species === 'CAT'
      ? 'Phòng ngừa Giảm bạch cầu (FPV), Viêm mũi khí quản, Calicivirus và Chlamydia.'
      : 'Phòng ngừa 7 bệnh truyền nhiễm nguy hiểm (Care, Parvo, Viêm gan, Ho cũi chó,...).',
    recommendedServiceCode: 'MED02',
    dueDate: vaccineDueDate.toISOString().split('T')[0],
    priority: vaccineEval.status === 'OVERDUE' ? 'HIGH' : 'MEDIUM',
    status: vaccineEval.status,
    completed: vaccineEval.completed,
    completedAt: vaccineEval.completedAt,
    lastCompletedAt: lastVaccineDate ? lastVaccineDate.toISOString() : null,
  });

  // 2. PARASITE CONTROL TIMELINE
  const dewormingIntervalDays = isPuppyOrKitten ? 30 : 90;
  const dewormingDueDate = lastDewormingDate
    ? new Date(lastDewormingDate.getTime() + dewormingIntervalDays * ONE_DAY_MS)
    : new Date(now.getTime() + 7 * ONE_DAY_MS);

  const dewormingKey = 'PARASITE_PREVENTION_ROUTINE';
  const dewormingEval = evaluateStatus(dewormingKey, dewormingDueDate);
  tasks.push({
    taskKey: dewormingKey,
    category: 'PARASITE',
    title: 'Tẩy giun & Nhỏ gáy phòng ve rận định kỳ',
    description: isPuppyOrKitten
      ? 'Tẩy giun mỗi tháng 1 lần cho thú non để đảm bảo tăng trọng và hấp thu dưỡng chất tốt.'
      : 'Uống thuốc tẩy nội ký sinh và nhỏ gáy phòng ve rận, bọ chét mỗi 3 tháng một lần.',
    recommendedServiceCode: 'MED03',
    dueDate: dewormingDueDate.toISOString().split('T')[0],
    priority: 'MEDIUM',
    status: dewormingEval.status,
    completed: dewormingEval.completed,
    completedAt: dewormingEval.completedAt,
    lastCompletedAt: lastDewormingDate ? lastDewormingDate.toISOString() : null,
  });

  // 3. GENERAL WELLNESS EXAM
  const wellnessIntervalDays = isSenior ? 180 : 365;
  const wellnessDueDate = lastWellnessDate
    ? new Date(lastWellnessDate.getTime() + wellnessIntervalDays * ONE_DAY_MS)
    : new Date(now.getTime() + 20 * ONE_DAY_MS);

  const wellnessKey = isSenior ? 'WELLNESS_SENIOR_CHECKUP' : 'WELLNESS_ANNUAL_CHECKUP';
  const wellnessEval = evaluateStatus(wellnessKey, wellnessDueDate);
  tasks.push({
    taskKey: wellnessKey,
    category: 'WELLNESS',
    title: isSenior
      ? 'Khám sức khỏe người cao tuổi & Tầm soát sớm (6 tháng/lần)'
      : 'Khám sức khỏe tổng quát định kỳ hàng năm',
    description: isSenior
      ? 'Kiểm tra chức năng tim mạch, khớp xương, xét nghiệm máu và siêu âm kiểm tra u nang ở thú cưng lớn tuổi.'
      : 'Kiểm tra lâm sàng mắt, tai, răng miệng, tim phổi và hạch ngoại vi để phòng ngừa bệnh tật sớm.',
    recommendedServiceCode: isSenior ? 'CMB03' : 'MED01',
    dueDate: wellnessDueDate.toISOString().split('T')[0],
    priority: isSenior ? 'HIGH' : 'LOW',
    status: wellnessEval.status,
    completed: wellnessEval.completed,
    completedAt: wellnessEval.completedAt,
    lastCompletedAt: lastWellnessDate ? lastWellnessDate.toISOString() : null,
  });

  // 4. GROOMING & HYGIENE CARE
  const groomingIntervalDays = 21; // 3 weeks
  const groomingDueDate = lastGroomingDate
    ? new Date(lastGroomingDate.getTime() + groomingIntervalDays * ONE_DAY_MS)
    : new Date(now.getTime() + 5 * ONE_DAY_MS);

  const groomingKey = 'GROOMING_REGULAR_HYGIENE';
  const groomingEval = evaluateStatus(groomingKey, groomingDueDate);
  tasks.push({
    taskKey: groomingKey,
    category: 'GROOMING',
    title: 'Vệ sinh chăm sóc lông, móng và tai',
    description: 'Tắm sạch sâu, sấy phồng tơi lông, cắt mài móng tránh cào xước và vệ sinh tai phòng nấm.',
    recommendedServiceCode: 'CMB01',
    dueDate: groomingDueDate.toISOString().split('T')[0],
    priority: 'LOW',
    status: groomingEval.status,
    completed: groomingEval.completed,
    completedAt: groomingEval.completedAt,
    lastCompletedAt: lastGroomingDate ? lastGroomingDate.toISOString() : null,
  });

  // 5. SPECIALIZED CONDITION-BASED RULES
  if (notes.includes('triệt sản') || notes.includes('phẫu thuật') || notes.includes('vết thương')) {
    const postOpKey = 'POST_OP_FOLLOW_UP';
    const postOpDueDate = new Date(now.getTime() + 3 * ONE_DAY_MS);
    const postOpEval = evaluateStatus(postOpKey, postOpDueDate);
    tasks.push({
      taskKey: postOpKey,
      category: 'SPECIALIZED',
      title: 'Tái khám kiểm tra vết mổ / vết thương',
      description: 'Kiểm tra độ liền da của vết thương mổ, thay băng tiệt trùng và đánh giá mức độ phục hồi.',
      recommendedServiceCode: 'MED01',
      dueDate: postOpDueDate.toISOString().split('T')[0],
      priority: 'HIGH',
      status: postOpEval.status,
      completed: postOpEval.completed,
      completedAt: postOpEval.completedAt,
    });
  }

  if (notes.includes('da liễu') || notes.includes('nấm') || notes.includes('viêm da') || notes.includes('ghẻ')) {
    const skinKey = 'DERMATOLOGY_MEDICATED_BATH';
    const skinDueDate = new Date(now.getTime() + 4 * ONE_DAY_MS);
    const skinEval = evaluateStatus(skinKey, skinDueDate);
    tasks.push({
      taskKey: skinKey,
      category: 'SPECIALIZED',
      title: 'Tắm trị liệu phục hồi da liễu & Chống nấm ngứa',
      description: 'Sử dụng dầu tắm kháng nấm và sát khuẩn da sinh học để phục hồi hàng rào bảo vệ biểu bì.',
      recommendedServiceCode: 'GRM06',
      dueDate: skinDueDate.toISOString().split('T')[0],
      priority: 'HIGH',
      status: skinEval.status,
      completed: skinEval.completed,
      completedAt: skinEval.completedAt,
    });
  }

  // Sort tasks: OVERDUE -> DUE_SOON -> UPCOMING -> COMPLETED, then by dueDate asc
  const statusRank = { OVERDUE: 0, DUE_SOON: 1, UPCOMING: 2, COMPLETED: 3 };
  tasks.sort((a, b) => {
    const rankDiff = statusRank[a.status] - statusRank[b.status];
    if (rankDiff !== 0) return rankDiff;
    return new Date(a.dueDate) - new Date(b.dueDate);
  });

  const summary = {
    totalTasks: tasks.length,
    overdueCount: tasks.filter((t) => t.status === 'OVERDUE').length,
    dueSoonCount: tasks.filter((t) => t.status === 'DUE_SOON').length,
    upcomingCount: tasks.filter((t) => t.status === 'UPCOMING').length,
    completedCount: tasks.filter((t) => t.status === 'COMPLETED').length,
  };

  return {
    petId: pet._id.toString(),
    petName: pet.name,
    species: pet.species,
    ageYears: pet.ageYears,
    weightKg: pet.weightKg,
    summary,
    tasks,
  };
};

