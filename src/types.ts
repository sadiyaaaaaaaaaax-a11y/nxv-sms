export interface ServiceItem {
  id: string;
  name: string;
  iconName: string;
  cost: number;
  popular?: boolean;
}

export interface CountryItem {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
}

export interface ActiveRange {
  id?: string;
  range: string;
  service: string;
  tag?: string;
  hits?: number;
  country?: string;
  carrier?: string;
  status?: string;
  successRate?: string;
  count?: number;
}

export interface SmsOrder {
  id: string;
  userId: string;
  userEmail?: string;
  phoneNumber: string;
  service: string;
  country: string;
  range: string;
  price?: number;
  status: 'WAITING' | 'RECEIVED' | 'EXPIRED' | 'CANCELLED';
  otpCode?: string;
  fullMessage?: string;
  orderRefId?: string;
  credited?: boolean;
  earnedAmount?: number;
  apiKey?: string;
  source?: 'api' | 'web';
  checkOtpUrl?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface BroadcastItem {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'ALERT' | 'UPDATE' | 'RANGE_ADDED';
  time?: string;
  createdAt?: string;
}

export interface ApiConfig {
  apiKeyMasked: string;
  hasKey: boolean;
  demoMode: boolean;
}

export interface ConsoleLog {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warn' | 'error';
  endpoint?: string;
  message: string;
  details?: any;
}

export type UserRole = 'user' | 'agent' | 'admin';
export type UserStatus = 'pending' | 'approved' | 'rejected';

export type ApiAccessStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  balance: number;
  totalNumbers: number;
  totalOtps: number;
  isBanned?: boolean;
  banReason?: string;
  agentEmail?: string;
  status?: UserStatus;
  perOtpRate?: number; // 0.30 to 0.60 BDT
  agentCommissionEarned?: number; // commission accumulated from referred users OTPs
  apiKey?: string;
  apiAccessStatus?: ApiAccessStatus;
  apiHits?: number;
  apiRequestReason?: string;
  apiRequestDate?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SystemSettings {
  noticeBanner: string;
  noticeBannerActive: boolean;
  maintenanceMode: boolean;
  agentDiscountPercent: number;
  defaultPricePerNumber: number;
  telegramSupportLink: string;
  whatsappSupportLink: string;
  updatedAt?: string;
}

export interface AdminStats {
  totalUsers: number;
  totalAgents: number;
  totalBanned: number;
  totalNumbersAllocated: number;
  totalOtpsDelivered: number;
  totalBalanceCirculation: number;
}

export type WithdrawMethod = 'bkash' | 'nagad' | 'binance';
export type WithdrawStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface WithdrawalRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  method: WithdrawMethod;
  accountNumber: string; // Phone number for bKash/Nagad or Binance Pay ID / UID
  amount: number;
  status: WithdrawStatus;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}
