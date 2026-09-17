import { ERROR_MESSAGES } from '@nexus/shared';
import type {
  AuthResponse,
  BonusOverviewDto,
  BonusType,
  CaseDetailDto,
  CaseDto,
  ClaimBonusResult,
  DepositDto,
  LeaderboardDto,
  LeaderboardMetric,
  NotificationDto,
  OpenCaseResult,
  PromoRedeemResult,
  ReferralDto,
  TransactionDto,
  UserDto,
  WinFeedItem,
  WithdrawalDto,
} from '@nexus/shared';

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

const TOKEN_KEY = 'nexus.token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Приватный режим браузера — работаем без сохранения сессии
  }
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /** Понятный игроку текст: серверное сообщение либо словарь кодов. */
  get humanMessage(): string {
    return this.message || ERROR_MESSAGES[this.code] || 'Что-то пошло не так';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken();

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (payload as { error?: { code: string; message: string; details?: unknown } } | null)?.error;
    // Протухший токен: чистим сессию, приложение переавторизуется само
    if (response.status === 401) setToken(null);
    throw new ApiError(error?.code ?? 'INTERNAL', error?.message ?? 'Ошибка запроса', response.status, error?.details);
  }

  return payload as T;
}

export const api = {
  auth: {
    telegram: (body: { initData?: string; devTelegramId?: number; devUsername?: string; startParam?: string }) =>
      request<AuthResponse>('/api/auth/telegram', { method: 'POST', body }),
  },
  user: {
    me: () => request<{ user: UserDto }>('/api/user'),
    transactions: (type = 'ALL') => request<{ items: TransactionDto[] }>(`/api/user/transactions?type=${type}`),
    openings: () =>
      request<{
        items: Array<{
          id: string;
          caseName: string;
          caseImage: string;
          rewardName: string;
          rewardImage: string;
          rarity: string;
          price: number;
          amount: number;
          profit: number;
          createdAt: string;
        }>;
      }>('/api/user/openings'),
    notifications: () => request<{ items: NotificationDto[] }>('/api/user/notifications'),
    readNotifications: () => request<{ updated: number }>('/api/user/notifications/read', { method: 'POST' }),
  },
  cases: {
    list: (category?: string) =>
      request<{ items: CaseDto[] }>(`/api/cases${category ? `?category=${category}` : ''}`),
    detail: (id: string) => request<{ case: CaseDetailDto }>(`/api/cases/${id}`),
    open: (id: string) => request<OpenCaseResult>(`/api/cases/${id}/open`, { method: 'POST' }),
  },
  wins: () => request<{ items: WinFeedItem[] }>('/api/wins'),
  bonus: {
    overview: () => request<BonusOverviewDto>('/api/bonus'),
    claim: (type: BonusType) => request<ClaimBonusResult>('/api/bonus/claim', { method: 'POST', body: { type } }),
  },
  promo: {
    redeem: (code: string) => request<PromoRedeemResult>('/api/promo/redeem', { method: 'POST', body: { code } }),
  },
  referrals: () => request<ReferralDto>('/api/referrals'),
  leaderboard: (metric: LeaderboardMetric) => request<LeaderboardDto>(`/api/leaderboard?metric=${metric}`),
  deposit: {
    list: () =>
      request<{
        items: DepositDto[];
        bonusPercent: number;
        providers: Array<{ id: string; title: string }>;
        activeProvider: string;
        currency: string;
        rate: number;
      }>('/api/deposit'),
    create: (amount: number) => request<{ deposit: DepositDto }>('/api/deposit', { method: 'POST', body: { amount } }),
  },
  withdrawal: {
    list: () =>
      request<{
        items: WithdrawalDto[];
        min: number;
        feePercent: number;
        methods: ReadonlyArray<{ id: string; label: string; placeholder: string }>;
      }>('/api/withdrawal'),
    create: (body: { amount: number; method: string; requisites: string }) =>
      request<{ withdrawal: WithdrawalDto }>('/api/withdrawal', { method: 'POST', body }),
  },
  admin: {
    stats: () => request<import('@nexus/shared').AdminStatsDto>('/api/admin/stats'),
    users: (query: string, page = 1) =>
      request<import('@nexus/shared').Paginated<import('@nexus/shared').AdminUserDto>>(
        `/api/admin/users?query=${encodeURIComponent(query)}&page=${page}`,
      ),
    adjustBalance: (id: string, amount: number, reason: string) =>
      request<{ balance: number }>(`/api/admin/users/${id}/balance`, { method: 'POST', body: { amount, reason } }),
    ban: (id: string, isBanned: boolean, reason?: string) =>
      request<{ user: import('@nexus/shared').AdminUserDto }>(`/api/admin/users/${id}/ban`, {
        method: 'POST',
        body: { isBanned, reason },
      }),
    cases: () => request<{ items: AdminCase[] }>('/api/admin/cases'),
    createCase: (body: AdminCaseInput) => request<{ case: AdminCase }>('/api/admin/cases', { method: 'POST', body }),
    updateCase: (id: string, body: Partial<AdminCaseInput>) =>
      request<{ case: AdminCase }>(`/api/admin/cases/${id}`, { method: 'PATCH', body }),
    disableCase: (id: string) => request<{ case: AdminCase }>(`/api/admin/cases/${id}`, { method: 'DELETE' }),
    promos: () => request<{ items: AdminPromo[] }>('/api/admin/promocodes'),
    createPromo: (body: {
      code: string;
      type: string;
      amount: number;
      maxActivations?: number | null;
      perUserLimit?: number;
      description?: string | null;
    }) => request<{ promo: AdminPromo }>('/api/admin/promocodes', { method: 'POST', body }),
    togglePromo: (id: string, isActive: boolean) =>
      request<{ promo: AdminPromo }>(`/api/admin/promocodes/${id}`, { method: 'PATCH', body: { isActive } }),
    withdrawals: (status?: string) =>
      request<{ items: AdminWithdrawal[] }>(`/api/admin/withdrawals${status ? `?status=${status}` : ''}`),
    approveWithdrawal: (id: string, comment?: string) =>
      request<{ withdrawal: WithdrawalDto }>(`/api/admin/withdrawals/${id}/approve`, { method: 'POST', body: { comment } }),
    rejectWithdrawal: (id: string, comment?: string) =>
      request<{ withdrawal: WithdrawalDto }>(`/api/admin/withdrawals/${id}/reject`, { method: 'POST', body: { comment } }),
    deposits: () => request<{ items: AdminDeposit[] }>('/api/admin/deposits'),
  },
};

export interface AdminReward {
  id?: string;
  name: string;
  amount: number;
  image: string;
  rarity: string;
  probability: number;
}

export interface AdminCase {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image: string;
  accent: string;
  price: number;
  category: string;
  isActive: boolean;
  sortOrder: number;
  cooldownSeconds: number | null;
  opened: number;
  rewards: AdminReward[];
}

export interface AdminCaseInput {
  slug: string;
  name: string;
  description?: string;
  image: string;
  accent: string;
  price: number;
  category: string;
  isActive: boolean;
  sortOrder: number;
  cooldownSeconds?: number | null;
  rewards: AdminReward[];
}

export interface AdminPromo {
  id: string;
  code: string;
  type: string;
  amount: number;
  maxActivations: number | null;
  activations: number;
  perUserLimit: number;
  expiresAt: string | null;
  isActive: boolean;
  description: string | null;
  uses: number;
  createdAt: string;
}

export interface AdminWithdrawal extends WithdrawalDto {
  requisitesFull: string;
  user: { id: string; name: string; telegramId: string };
}

export interface AdminDeposit {
  id: string;
  amount: number;
  bonusAmount: number;
  status: string;
  provider: string;
  createdAt: string;
  paidAt: string | null;
  user: { id: string; name: string; telegramId: string };
}
