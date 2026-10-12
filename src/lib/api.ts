import { ActiveRange, BroadcastItem } from '../types';
import { detectCountryFromRange } from './countryUtils';

export const API = {
  // 1. Live Active Ranges
  async getActiveRanges(): Promise<{
    success: boolean;
    ranges: ActiveRange[];
    raw?: any;
    message?: string;
  }> {
    try {
      const res = await fetch('/api/zenex/active-ranges');
      const json = await res.json();

      const isSuccess = res.ok && (json.success === true || json.meta?.status === 'success');
      const list = json.data?.active_ranges || (Array.isArray(json.data) ? json.data : []);

      const formattedRanges: ActiveRange[] = list.map((item: any, idx: number) => {
        const countryInfo = detectCountryFromRange(item.range);
        return {
          id: item.range || `rng-${idx}`,
          range: item.range,
          service: item.service || 'OTHER',
          tag: item.tag || 'General',
          hits: item.hits || 0,
          country: `${countryInfo.flag} ${countryInfo.name}`,
          carrier: item.tag || item.service || 'Carrier Route',
          status: 'ACTIVE',
          successRate: item.hits ? `${item.hits} Hits` : 'Active',
          count: item.hits || 0,
        };
      });

      return {
        success: isSuccess,
        ranges: formattedRanges,
        raw: json,
        message: json.message || (isSuccess ? 'Active ranges fetched' : 'Could not fetch active routes'),
      };
    } catch (err: any) {
      return { success: false, ranges: [], message: err.message };
    }
  },

  // 2. Provision Virtual Number
  async getNumber(params: {
    range: string;
    service?: string;
    country?: string;
  }): Promise<{
    success: boolean;
    number?: string;
    operator?: string;
    country?: string;
    orderId?: string;
    message?: string;
    raw?: any;
  }> {
    try {
      const res = await fetch('/api/zenex/getnum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          range: params.range,
          service: params.service || 'general',
          is_national: false,
          remove_plus: false,
        }),
      });

      const json = await res.json();
      const isSuccess = res.ok && (json.meta?.status === 'success' || json.success === true);

      const numData = json.data;
      const phoneNumber = numData?.copy || numData?.number || numData?.full_number;

      return {
        success: isSuccess && Boolean(phoneNumber),
        number: phoneNumber,
        operator: numData?.operator,
        country: numData?.country || params.country,
        orderId: numData?.full_number || phoneNumber || `ORD-${Date.now()}`,
        message: json.message || (isSuccess ? 'Virtual number provisioned successfully' : (json.error || 'Carrier Route Error')),
        raw: json,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Network error connecting to carrier gateway',
      };
    }
  },

  // 3. Receive OTP Information
  async checkOtp(targetPhoneNumber?: string): Promise<{
    success: boolean;
    found: boolean;
    otp?: string;
    fullMessage?: string;
    raw?: any;
  }> {
    try {
      const res = await fetch('/api/zenex/numsuccess/info');
      const json = await res.json();

      const otpsList: any[] = json.data?.otps || (Array.isArray(json.data) ? json.data : []);

      if (targetPhoneNumber && otpsList.length > 0) {
        const cleanTarget = targetPhoneNumber.replace(/[^0-9]/g, '');

        // Find matching OTP for this number
        const match = otpsList.find((item: any) => {
          const itemNum = String(item.number || '').replace(/[^0-9]/g, '');
          return itemNum && (itemNum === cleanTarget || cleanTarget.endsWith(itemNum) || itemNum.endsWith(cleanTarget));
        });

        if (match) {
          let code = match.otp;
          const matchCode = String(match.otp || '').match(/\b\d{4,8}\b/);
          if (matchCode) {
            code = matchCode[0];
          }

          return {
            success: true,
            found: true,
            otp: code,
            fullMessage: match.otp,
            raw: match,
          };
        }
      }

      return {
        success: res.ok,
        found: false,
        raw: json,
      };
    } catch {
      return {
        success: false,
        found: false,
      };
    }
  },

  // 3b. Fetch all live OTP records from gateway
  async getAllOtps(): Promise<{
    success: boolean;
    otps: Array<{
      nid?: string;
      number: string;
      otp: string;
      country?: string;
      operator?: string;
      created_at?: string;
    }>;
  }> {
    try {
      const res = await fetch('/api/zenex/numsuccess/info');
      const json = await res.json();
      const list = json.data?.otps || (Array.isArray(json.data) ? json.data : []);
      return { success: res.ok, otps: list };
    } catch {
      return { success: false, otps: [] };
    }
  },

  // 4. Live Global Broadcast Feed
  async getGlobalBroadcast(): Promise<{
    success: boolean;
    broadcasts: BroadcastItem[];
    raw?: any;
  }> {
    try {
      const res = await fetch('/api/zenex/global-broadcast');
      const json = await res.json();

      const isSuccess = res.ok && json.success === true;
      const list: any[] = json.data || [];

      const formatted: BroadcastItem[] = list.map((b: any, idx: number) => {
        const rawNum = String(b.number || '');
        const maskedNum = rawNum.length > 5
          ? `${rawNum.slice(0, 4)}••••${rawNum.slice(-2)}`
          : '••••••';

        return {
          id: b.id || `bc-${idx}`,
          title: `${b.service || 'SMS'} Route (${b.country || 'Global'})`,
          message: `Live Gateway Delivery on ${maskedNum} • [OTP Code Received & Protected]`,
          type: 'UPDATE',
          time: b.time ? new Date(Number(b.time)).toLocaleTimeString() : 'Live',
        };
      });

      return {
        success: isSuccess,
        broadcasts: formatted,
        raw: json,
      };
    } catch {
      return { success: false, broadcasts: [] };
    }
  },

  // 5. Get Gateway Config
  async getApiConfig(): Promise<{
    apiKeyMasked: string;
    hasKey: boolean;
    endpoints?: Record<string, string>;
  }> {
    try {
      const res = await fetch('/api/zenex/config');
      return await res.json();
    } catch {
      return { apiKeyMasked: '', hasKey: false };
    }
  },

  // 6. Update Gateway API Key
  async updateApiKey(apiKey: string): Promise<{
    success: boolean;
    apiKeyMasked: string;
    message?: string;
  }> {
    try {
      const res = await fetch('/api/zenex/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, apiKeyMasked: '', message: err.message };
    }
  },
};
