/**
 * Deterministic Veterinary Triage Rules & Fallback Matrix
 * Used for instant triage and emergency detection
 */

export const EMERGENCY_KEYWORDS = [
  'co giật', 'động kinh', 'sùi bọt mép', 'khó thở', 'thở dốc', 'tím tái',
  'ngộ độc', 'ăn bả', 'thuốc chuột', 'chảy máu ồ ạt', 'xuất huyết', 'hôn mê',
  'bất tỉnh', 'sốc nhiệt', 'đâm xe', 'gãy xương', 'bí tiểu hoàn toàn', 'lòi ruột'
];

export const VET_DISCLAIMER =
  '⚠️ LƯU Ý Y KHOA: Kết quả sàng lọc chỉ mang tính chất tham khảo ban đầu và hoàn toàn KHÔNG thay thế cho chẩn đoán trực tiếp của Bác sĩ thú y. Nếu thú cưng có biểu hiện nguy cấp, hãy đưa bé đến phòng khám thú y gần nhất hoặc liên hệ Hotline Cấp cứu 24/7.';

export const evaluateDeterministicTriage = ({ species = 'DOG', symptoms = '' }) => {
  const text = symptoms.toLowerCase();

  // 1. Red-flag check
  const isEmergency = EMERGENCY_KEYWORDS.some((kw) => text.includes(kw));
  if (isEmergency) {
    return {
      attentionLevel: 'EMERGENCY',
      attentionLabel: '🚨 CẤP CỨU KHẨN CẤP 24/7',
      summary: 'Thú cưng đang có dấu hiệu nguy kịch đe dọa tính mạng.',
      possibleCauses: [
        'Ngộ độc cấp tính hoặc sốc phản vệ',
        'Suy hô hấp cấp / Phù phổi cấp',
        'Chấn thương nội tạng / Xuất huyết nội',
        'Tắc nghẽn đường tiểu / Co giật thần kinh trung ương'
      ],
      nextSteps: [
        'Gọi ngay hotline cấp cứu 1900-PET-EMERGENCY hoặc đưa bé đến cơ sở thú y gần nhất.',
        'Giữ thú cưng nằm yên ở nơi thoáng mát, đệm êm, không cho ăn uống bất cứ thứ gì.',
        'Nếu nghi ngờ ngộ độc, chụp lại bao bì hóa chất/cây cối bé đã tiếp xúc mang theo.'
      ],
      recommendedServiceCodes: ['MED07'],
      recommendedArticleKeywords: ['cấp cứu', 'ngộ độc', 'sơ cứu'],
    };
  }

  // 2. High Attention Symptoms (Persistent vomiting, bloody stool, severe lethargy)
  if (text.includes('nôn ra máu') || text.includes('tiêu chảy ra máu') || text.includes('sốt cao') || text.includes('nôn nhiều') || text.includes('li bì')) {
    return {
      attentionLevel: 'HIGH',
      attentionLabel: 'Khám ngay trong ngày',
      summary: 'Dấu hiệu tiêu hóa cấp tính hoặc nhiễm trùng nguy cơ mất nước nặng.',
      possibleCauses: [
        species === 'CAT' ? 'Nhiễm virus Giảm bạch cầu (FPV) hoặc dị vật tiêu hóa' : 'Nhiễm virus Parvo / Care hoặc viêm tụy cấp',
        'Viêm dạ dày ruột xuất huyết',
        'Nhiễm khuẩn đường ruột nghiêm trọng'
      ],
      nextSteps: [
        'Đưa bé đến phòng khám trong vòng 6-12 giờ để truyền dịch chống mất nước.',
        'Tạm ngừng cho ăn thức ăn hạt đặc trong 4-6 giờ, chỉ cung cấp nước sạch từng chút một.',
        'Quan sát màu sắc phân và tần suất nôn để báo với Bác sĩ.'
      ],
      recommendedServiceCodes: ['MED01', 'MED04', 'MED05'],
      recommendedArticleKeywords: ['tiêu hóa', 'nôn', 'chăm sóc'],
    };
  }

  // 3. Medium Attention Symptoms (Skipping meals, mild diarrhea, mild cough, ear discharge)
  if (text.includes('bỏ ăn') || text.includes('tiêu chảy') || text.includes('ho') || text.includes('chảy mũi') || text.includes('gãi tai') || text.includes('hôi tai')) {
    return {
      attentionLevel: 'MEDIUM',
      attentionLabel: 'Cần đưa đi khám trong 24-48h',
      summary: 'Rối loạn sức khỏe nhẹ đến vừa, cần được bác sĩ thăm khám và kiểm tra lâm sàng.',
      possibleCauses: [
        'Rối loạn tiêu hóa do thức ăn lạ hoặc thay đổi khẩu phần',
        'Cảm lạnh nhẹ / Viêm đường hô hấp trên',
        'Viêm tai ngoài do ve rận tai hoặc nấm tai'
      ],
      nextSteps: [
        'Theo dõi nhiệt độ và tinh thần của bé trong ngày.',
        'Nếu bé bỏ ăn quá 24h hoặc tiêu chảy tăng lên, đặt lịch khám tại phòng khám.',
        'Cho bé uống nhiều nước và giữ ấm cơ thể.'
      ],
      recommendedServiceCodes: ['MED01', 'MED03'],
      recommendedArticleKeywords: ['tiêu hóa', 'dinh dưỡng'],
    };
  }

  // 4. Low Attention Symptoms (Itchy skin, bad breath, overgrown nails, shedding)
  if (text.includes('rụng lông') || text.includes('gãi') || text.includes('ngứa') || text.includes('hôi miệng') || text.includes('dài móng') || text.includes('dơ lông')) {
    return {
      attentionLevel: 'LOW',
      attentionLabel: 'Theo dõi tại nhà & Chăm sóc Spa/Vệ sinh',
      summary: 'Tình trạng ngoại khoa hoặc da lông nhẹ, có thể cải thiện bằng vệ sinh chăm sóc.',
      possibleCauses: [
        'Rụng lông theo mùa hoặc thiếu dưỡng chất kẽm/omega-3',
        'Viêm da dị ứng nhẹ hoặc ký sinh trùng ngoài da',
        'Mảng bám cao răng tích tụ'
      ],
      nextSteps: [
        'Chải lông hàng ngày và tắm bằng sữa tắm thảo mộc dưỡng ẩm.',
        'Vệ sinh tai và cắt tỉa móng định kỳ.',
        'Nếu da ửng đỏ hoặc có mụn mủ, hãy đặt lịch khám da liễu.'
      ],
      recommendedServiceCodes: ['CMB01', 'GRM01', 'GRM03'],
      recommendedArticleKeywords: ['vệ sinh', 'spa', 'lông'],
    };
  }

  // 5. Default General Inquiry
  return {
    attentionLevel: 'LOW',
    attentionLabel: 'Theo dõi thường quy',
    summary: 'Chưa phát hiện triệu chứng cấp tính bất thường. Khuyên nên duy trì lịch chăm sóc định kỳ.',
    possibleCauses: ['Thể trạng bình thường hoặc thay đổi sinh lý nhẹ'],
    nextSteps: [
      'Tiếp tục theo dõi khẩu phần ăn và mức độ hoạt bát của thú cưng.',
      'Khám sức khỏe tổng quát định kỳ mỗi 6 - 12 tháng.',
      'Đảm bảo tiêm phòng và tẩy giun đầy đủ theo lịch.'
    ],
    recommendedServiceCodes: ['MED01'],
    recommendedArticleKeywords: ['sức khỏe', 'chăm sóc'],
  };
};

