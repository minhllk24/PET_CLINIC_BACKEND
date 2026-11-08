/**
 * Gemini Client for AI Symptom Screening with 6s AbortController timeout
 */
import config from '../../shared/config';
import { logger } from '../../shared/logger';

const GEMINI_MODEL = 'gemini-1.5-flash';

export const callGeminiTriage = async ({ species, ageYears, weightKg, symptoms }) => {
  const apiKey = process.env.GEMINI_API_KEY || config.geminiApiKey;
  if (!apiKey) {
    return null; // Fallback immediately if no API key
  }

  const prompt = `Bạn là Trợ lý Sàng lọc Triệu chứng Thú y (Veterinary Triage AI Assistant) của Phòng khám thú y Dr. Pet's House.
Hãy đánh giá triệu chứng của thú cưng dưới đây và phân loại mức độ khẩn cấp theo tiêu chuẩn lâm sàng thú y:
- Loài: ${species || 'Không rõ'}
- Độ tuổi: ${ageYears ? `${ageYears} tuổi` : 'Không rõ'}
- Cân nặng: ${weightKg ? `${weightKg} kg` : 'Không rõ'}
- Triệu chứng: "${symptoms}"

YÊU CẦU:
1. attentionLevel: Chỉ được chọn 1 trong 4 giá trị: "LOW", "MEDIUM", "HIGH", "EMERGENCY".
2. attentionLabel: Nhãn ngắn gọn tiếng Việt (ví dụ: "Theo dõi tại nhà & Chăm sóc Spa/Vệ sinh", "Cần đưa đi khám trong 24-48h", "Khám ngay trong ngày", "CẤP CỨU KHẨN CẤP 24/7").
3. summary: Tóm tắt tình trạng và nhận định ngắn gọn (1-2 câu).
4. possibleCauses: Danh sách 2-4 nguyên nhân tiềm ẩn phổ biến (không khẳng định chắc chắn).
5. nextSteps: Danh sách 2-4 hướng dẫn hành động cụ thể cho chủ nuôi.
6. recommendedServiceCodes: Mã dịch vụ phù hợp trong hệ thống: MED01 (Khám tổng quát), MED02 (Tiêm vaccine), MED03 (Tẩy giun), MED04 (Siêu âm/X-quang), MED05 (Xét nghiệm máu), MED06 (Phẫu thuật), MED07 (Cấp cứu 24/7), GRM01 (Tắm spa), GRM06 (Cạo lông/da liễu), CMB01 (Combo Spa), CMB03 (Combo Khám tầm soát).

Trả về ĐÚNG ĐỊNH DẠNG JSON sau (không kèm markdown):
{
  "attentionLevel": "LOW | MEDIUM | HIGH | EMERGENCY",
  "attentionLabel": "string",
  "summary": "string",
  "possibleCauses": ["string"],
  "nextSteps": ["string"],
  "recommendedServiceCodes": ["string"]
}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          maxOutputTokens: 1000,
        },
      }),
      signal: AbortSignal.timeout(6000), // 6 seconds timeout
    });

    if (!response.ok) {
      logger.warn(`[AI Assistant] Gemini API returned status ${response.status}`);
      return null;
    }

    const resJson = await response.json();
    const candidateText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) return null;

    const parsed = JSON.parse(candidateText);
    return parsed;
  } catch (err) {
    logger.warn(`[AI Assistant] Gemini call failed or timed out (${err.message}). Using deterministic fallback.`);
    return null;
  }
};

