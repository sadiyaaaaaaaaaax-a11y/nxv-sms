export interface RangeCountryInfo {
  name: string;
  code: string;
  flag: string;
  dialCode: string;
}

export function detectCountryFromRange(range: string): RangeCountryInfo {
  if (!range) return { name: 'Global Line', code: 'GL', flag: '🌐', dialCode: '+' };
  const clean = range.replace(/[^0-9]/g, '');

  if (clean.startsWith('237')) return { name: 'Cameroon', code: 'CM', flag: '🇨🇲', dialCode: '+237' };
  if (clean.startsWith('261')) return { name: 'Madagascar', code: 'MG', flag: '🇲🇬', dialCode: '+261' };
  if (clean.startsWith('228')) return { name: 'Togo', code: 'TG', flag: '🇹🇬', dialCode: '+228' };
  if (clean.startsWith('32')) return { name: 'Belgium', code: 'BE', flag: '🇧🇪', dialCode: '+32' };
  if (clean.startsWith('996')) return { name: 'Kyrgyzstan', code: 'KG', flag: '🇰🇬', dialCode: '+996' };
  if (clean.startsWith('234')) return { name: 'Nigeria', code: 'NG', flag: '🇳🇬', dialCode: '+234' };
  if (clean.startsWith('380')) return { name: 'Ukraine', code: 'UA', flag: '🇺🇦', dialCode: '+380' };
  if (clean.startsWith('95')) return { name: 'Myanmar', code: 'MM', flag: '🇲🇲', dialCode: '+95' };
  if (clean.startsWith('992')) return { name: 'Tajikistan', code: 'TJ', flag: '🇹🇯', dialCode: '+992' };
  if (clean.startsWith('44')) return { name: 'United Kingdom', code: 'GB', flag: '🇬🇧', dialCode: '+44' };
  if (clean.startsWith('880')) return { name: 'Bangladesh', code: 'BD', flag: '🇧🇩', dialCode: '+880' };
  if (clean.startsWith('1')) return { name: 'United States', code: 'US', flag: '🇺🇸', dialCode: '+1' };
  if (clean.startsWith('91')) return { name: 'India', code: 'IN', flag: '🇮🇳', dialCode: '+91' };
  if (clean.startsWith('7')) return { name: 'Russia', code: 'RU', flag: '🇷🇺', dialCode: '+7' };
  if (clean.startsWith('62')) return { name: 'Indonesia', code: 'ID', flag: '🇮🇩', dialCode: '+62' };
  if (clean.startsWith('63')) return { name: 'Philippines', code: 'PH', flag: '🇵🇭', dialCode: '+63' };
  if (clean.startsWith('84')) return { name: 'Vietnam', code: 'VN', flag: '🇻🇳', dialCode: '+84' };
  if (clean.startsWith('254')) return { name: 'Kenya', code: 'KE', flag: '🇰🇪', dialCode: '+254' };
  if (clean.startsWith('27')) return { name: 'South Africa', code: 'ZA', flag: '🇿🇦', dialCode: '+27' };
  if (clean.startsWith('49')) return { name: 'Germany', code: 'DE', flag: '🇩🇪', dialCode: '+49' };
  if (clean.startsWith('33')) return { name: 'France', code: 'FR', flag: '🇫🇷', dialCode: '+33' };
  if (clean.startsWith('971')) return { name: 'UAE', code: 'AE', flag: '🇦🇪', dialCode: '+971' };
  if (clean.startsWith('966')) return { name: 'Saudi Arabia', code: 'SA', flag: '🇸🇦', dialCode: '+966' };

  return { name: 'Global Line', code: 'GL', flag: '🌐', dialCode: '+' };
}

export function normalizeServiceName(rawName: string): { key: string; displayName: string } {
  const trimmed = (rawName || '').trim();
  const lower = trimmed.toLowerCase();

  if (lower === 'facebook' || lower === 'fb') return { key: 'facebook', displayName: 'Facebook' };
  if (lower === 'instagram' || lower === 'insta' || lower === 'ig') return { key: 'instagram', displayName: 'Instagram' };
  if (lower === 'whatsapp' || lower === 'wa') return { key: 'whatsapp', displayName: 'WhatsApp' };
  if (lower === 'telegram' || lower === 'tg') return { key: 'telegram', displayName: 'Telegram' };
  if (lower === 'discord') return { key: 'discord', displayName: 'Discord' };
  if (lower === 'authmsg') return { key: 'authmsg', displayName: 'AuthMsg / SMS' };
  if (lower === 'google' || lower === 'gmail') return { key: 'google', displayName: 'Google' };
  if (lower === 'tiktok') return { key: 'tiktok', displayName: 'TikTok' };
  if (lower === 'twitter' || lower === 'x') return { key: 'twitter', displayName: 'Twitter / X' };

  const pretty = trimmed
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  return { key: lower, displayName: pretty || 'Other SMS' };
}
