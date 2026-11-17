/**
 * Tiện ích hỗ trợ tìm kiếm Tiếng Việt không dấu và có dấu đa năng
 */
export const buildVietnameseSearchRegex = (str) => {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  if (!trimmed) return null;

  const vnCharMap = {
    a: '[aàáảãạăằắẳẵặâầấẩẫậ]',
    d: '[dđ]',
    e: '[eèéẻẽẹêềếểễệ]',
    i: '[iìíỉĩị]',
    o: '[oòóỏõọôồốổỗộơờớởỡợ]',
    u: '[uùúủũụưừứửữự]',
    y: '[yỳýỷỹỵ]'
  };

  const normalized = trimmed.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  let pattern = '';
  for (const ch of normalized) {
    if (vnCharMap[ch]) {
      pattern += vnCharMap[ch];
    } else if (/[.*+?^${}()|[\]\\]/.test(ch)) {
      pattern += '\\' + ch;
    } else {
      pattern += ch;
    }
  }
  return new RegExp(pattern, 'i');
};
