import type { Language } from './types';

export interface ChestDefinition {
  key: string;
  nameEn: string;
  nameVi: string;
  keywordsEn: string[];
  keywordsVi: string[];
}

export const DEFAULT_CHESTS: ChestDefinition[] = [
  {
    key: 'technology',
    nameEn: 'Technology',
    nameVi: 'Công nghệ & Kỹ thuật',
    keywordsEn: [
      'software', 'hardware', 'computer', 'internet', 'data', 'system', 'network',
      'digital', 'algorithm', 'program', 'code', 'server', 'cloud', 'ai', 'artificial',
      'intelligence', 'machine', 'database', 'cyber', 'tech', 'online', 'website',
      'application', 'device', 'gadget', 'robot', 'automation', 'pixel', 'browser',
      'download', 'upload', 'interface', 'protocol', 'encryption', 'framework',
      'processor', 'memory', 'bandwidth', 'software', 'platform', 'virtual',
    ],
    keywordsVi: [
      'công nghệ', 'phần mềm', 'phần cứng', 'máy tính', 'mạng', 'hệ thống',
      'trí tuệ nhân tạo', 'dữ liệu', 'chương trình', 'mã', 'máy chủ', 'đám mây',
      'thuật toán', 'giao diện', 'thiết bị', 'tự động', 'trình duyệt',
      'tải', 'băng thông', 'nền tảng', 'ảo', 'robot', 'an ninh mạng',
    ],
  },
  {
    key: 'business',
    nameEn: 'Business & Finance',
    nameVi: 'Kinh tế & Doanh nghiệp',
    keywordsEn: [
      'market', 'finance', 'strategy', 'money', 'sales', 'leader', 'business',
      'company', 'corporate', 'investment', 'profit', 'revenue', 'budget',
      'economy', 'trade', 'commerce', 'management', 'executive', 'shareholder',
      'dividend', 'asset', 'liability', 'capital', 'merger', 'acquisition',
      'negotiation', 'contract', 'client', 'customer', 'marketing', 'brand',
      'advertising', 'startup', 'entrepreneur', 'venture', 'fiscal', 'monetary',
    ],
    keywordsVi: [
      'kinh tế', 'doanh nghiệp', 'thị trường', 'tài chính', 'chiến lược',
      'tiền', 'bán hàng', 'lãnh đạo', 'công ty', 'đầu tư', 'lợi nhuận',
      'doanh thu', 'ngân sách', 'thương mại', 'quản lý', 'cổ đông',
      'vốn', 'hợp đồng', 'khách hàng', 'tiếp thị', 'thương hiệu',
      'quảng cáo', 'khởi nghiệp', 'đàm phán', 'tài sản', 'thu nhập',
    ],
  },
  {
    key: 'dailyLife',
    nameEn: 'Daily Life',
    nameVi: 'Đời sống & Hằng ngày',
    keywordsEn: [
      'food', 'home', 'travel', 'emotion', 'family', 'routine', 'cook',
      'eat', 'drink', 'sleep', 'walk', 'run', 'friend', 'love', 'happy',
      'sad', 'angry', 'house', 'apartment', 'kitchen', 'bedroom', 'garden',
      'shopping', 'clothes', 'weather', 'rain', 'sun', 'weekend', 'holiday',
      'vacation', 'hobby', 'sport', 'music', 'movie', 'game', 'phone',
      'car', 'bike', 'street', 'city', 'village', 'neighbor', 'pet', 'dog', 'cat',
    ],
    keywordsVi: [
      'đời sống', 'thức ăn', 'nhà', 'du lịch', 'cảm xúc', 'gia đình',
      'thường ngày', 'nấu', 'ăn', 'uống', 'ngủ', 'đi bộ', 'chạy', 'bạn bè',
      'yêu', 'vui', 'buồn', 'tức giận', 'bếp', 'phòng', 'vườn', 'mua sắm',
      'quần áo', 'thời tiết', 'mưa', 'nắng', 'cuối tuần', 'kỳ nghỉ',
      'sở thích', 'thể thao', 'âm nhạc', 'phim', 'trò chơi', 'điện thoại',
      'xe', 'phố', 'thành phố', 'làng', 'hàng xóm', 'thú cưng',
    ],
  },
  {
    key: 'academic',
    nameEn: 'Academic & Education',
    nameVi: 'Học thuật & Giáo dục',
    keywordsEn: [
      'research', 'study', 'theory', 'analysis', 'school', 'university',
      'education', 'learn', 'teach', 'student', 'professor', 'lecture',
      'thesis', 'hypothesis', 'experiment', 'science', 'biology', 'chemistry',
      'physics', 'mathematics', 'literature', 'philosophy', 'psychology',
      'sociology', 'history', 'geography', 'academic', 'scholar', 'knowledge',
      'curriculum', 'exam', 'degree', 'diploma', 'campus', 'library', 'laboratory',
    ],
    keywordsVi: [
      'học thuật', 'nghiên cứu', 'học', 'lý thuyết', 'phân tích', 'trường',
      'đại học', 'giáo dục', 'dạy', 'sinh viên', 'giáo sư', 'bài giảng',
      'luận văn', 'giả thuyết', 'thí nghiệm', 'khoa học', 'sinh học',
      'hóa học', 'vật lý', 'toán', 'văn học', 'triết học', 'tâm lý học',
      'xã hội học', 'lịch sử', 'địa lý', 'học giả', 'kiến thức',
      'chương trình', 'thi', 'bằng cấp', 'thư viện', 'phòng thí nghiệm',
    ],
  },
  {
    key: 'communication',
    nameEn: 'Communication & Behavior',
    nameVi: 'Giao tiếp & Ứng xử',
    keywordsEn: [
      'interaction', 'relationship', 'attitude', 'speak', 'talk', 'listen',
      'communicate', 'conversation', 'discuss', 'argue', 'persuade', 'convince',
      'express', 'gesture', 'body language', 'tone', 'voice', 'message',
      'apologize', 'compliment', 'criticize', 'praise', 'encourage', 'blame',
      'forgive', 'respect', 'polite', 'rude', 'friendly', 'hostile', 'cooperate',
      'negotiate', 'agree', 'disagree', 'respond', 'react', 'behavior',
    ],
    keywordsVi: [
      'giao tiếp', 'mối quan hệ', 'thái độ', 'nói', 'nghe', 'trò chuyện',
      'thảo luận', 'tranh luận', 'thuyết phục', 'bày tỏ', 'cử chỉ',
      'ngôn ngữ cơ thể', 'giọng điệu', 'thông điệp', 'xin lỗi', 'khen',
      'chỉ trích', 'động viên', 'đổ lỗi', 'tha thứ', 'tôn trọng',
      'lịch sự', 'thô lỗ', 'thân thiện', 'hợp tác', 'đàm phán',
      'đồng ý', 'phản hồi', 'ứng xử', 'hành vi',
    ],
  },
];

export const FALLBACK_CHEST_KEY = 'general';

export const FALLBACK_CHEST: ChestDefinition = {
  key: 'general',
  nameEn: 'General',
  nameVi: 'Chung',
  keywordsEn: [],
  keywordsVi: [],
};

export function getChestName(key: string, lang: Language): string {
  const chest = DEFAULT_CHESTS.find((c) => c.key === key);
  if (chest) return lang === 'vi' ? chest.nameVi : chest.nameEn;
  if (key === FALLBACK_CHEST_KEY) return lang === 'vi' ? FALLBACK_CHEST.nameVi : FALLBACK_CHEST.nameEn;
  return key;
}

export function autoCategorize(word: string, meaning: string): string {
  const wordLower = word.toLowerCase();
  const meaningLower = meaning.toLowerCase();
  const text = `${wordLower} ${meaningLower}`;

  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const chest of DEFAULT_CHESTS) {
    let score = 0;
    for (const kw of chest.keywordsEn) {
      if (text.includes(kw.toLowerCase())) {
        score += kw.length > 4 ? 2 : 1;
      }
    }
    for (const kw of chest.keywordsVi) {
      if (meaningLower.includes(kw.toLowerCase())) {
        score += kw.length > 4 ? 2 : 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = chest.key;
    }
  }

  return bestMatch || FALLBACK_CHEST_KEY;
}

export function getAllChestNames(lang: Language): string[] {
  const names = DEFAULT_CHESTS.map((c) => (lang === 'vi' ? c.nameVi : c.nameEn));
  names.push(lang === 'vi' ? FALLBACK_CHEST.nameVi : FALLBACK_CHEST.nameEn);
  return names;
}

export function chestKeyToName(key: string, lang: Language): string {
  return getChestName(key, lang);
}

export function chestNameToKey(name: string, lang: Language): string {
  for (const chest of DEFAULT_CHESTS) {
    if (name === chest.nameEn || name === chest.nameVi) return chest.key;
  }
  return name;
}
