/** Контракты API — единственный источник правды для сервера и клиента. */

export type CaseCategory = 'POPULAR' | 'PREMIUM' | 'REGULAR' | 'THEMATIC' | 'FREE';
/** Тиры редкости повторяют игровые в Steal a Brainrot. */
export type Rarity =
  | 'COMMON'
  | 'RARE'
  | 'EPIC'
  | 'LEGENDARY'
  | 'MYTHIC'
  | 'BRAINROT_GOD'
  | 'SECRET'
  | 'OG';
export type BonusType = 'DAILY' | 'STREAK' | 'SUBSCRIPTION' | 'REFERRAL_MILESTONE' | 'FREE_CASE';
export type PromoType = 'BALANCE' | 'DEPOSIT_PERCENT' | 'XP';
export type WithdrawalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type DepositStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED';
export type TransactionType =
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'WITHDRAWAL_REFUND'
  | 'CASE_PURCHASE'
  | 'CASE_REWARD'
  | 'BONUS'
  | 'PROMO'
  | 'REFERRAL'
  | 'ADMIN_ADJUST';
export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface UserDto {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  avatar: string | null;
  balance: number;
  level: number;
  xp: number;
  levelTitle: string;
  progress: { percent: number; xpIntoLevel: number; xpForNextLevel: number; isMax: boolean };
  referralCode: string;
  isAdmin: boolean;
  isBanned: boolean;
  stats: {
    casesOpened: number;
    totalWon: number;
    totalDeposited: number;
    totalWagered: number;
    referrals: number;
    referralEarned: number;
    loginStreak: number;
  };
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: UserDto;
  startBonus?: number;
}

export interface CaseRewardDto {
  id: string;
  name: string;
  amount: number;
  image: string;
  rarity: Rarity;
  /** Нормализованный шанс в процентах — показывается игроку. */
  chance: number;
}

export interface CaseDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image: string;
  accent: string;
  price: number;
  category: CaseCategory;
  isFree: boolean;
  minReward: number;
  maxReward: number;
  rewardCount: number;
  cooldownSeconds: number | null;
  /** Для бесплатных кейсов: сколько секунд осталось до следующего открытия. */
  availableInSeconds?: number;
}

export interface CaseDetailDto extends CaseDto {
  rewards: CaseRewardDto[];
}

export interface OpenCaseResult {
  opening: {
    id: string;
    caseId: string;
    caseName: string;
    price: number;
    amount: number;
    profit: number;
    createdAt: string;
  };
  reward: CaseRewardDto;
  /** Лента для анимации — сформирована сервером, выигрышный индекс фиксирован. */
  roll: { items: CaseRewardDto[]; winnerIndex: number };
  balance: number;
  level: number;
  xp: number;
  levelUp: boolean;
  nextFreeCaseInSeconds?: number;
}

export interface BonusCardDto {
  type: BonusType;
  title: string;
  description: string;
  amount: number;
  available: boolean;
  claimed: boolean;
  availableInSeconds: number;
  progress?: { current: number; target: number };
  meta?: Record<string, unknown>;
}

export interface BonusOverviewDto {
  dailyOffer: { percent: number; endsInSeconds: number; title: string };
  streak: { current: number; target: number; nextReward: number };
  bonuses: BonusCardDto[];
}

export interface ClaimBonusResult {
  type: BonusType;
  amount: number;
  balance: number;
  xp: number;
  level: number;
  message: string;
}

export interface PromoRedeemResult {
  code: string;
  type: PromoType;
  amount: number;
  balance: number;
  message: string;
}

export interface ReferralDto {
  code: string;
  link: string;
  shareText: string;
  invited: number;
  earned: number;
  referrerBonus: number;
  refereeBonus: number;
  list: Array<{
    id: string;
    name: string;
    avatar: string | null;
    level: number;
    earned: number;
    joinedAt: string;
  }>;
}

export type LeaderboardMetric = 'wins' | 'balance' | 'cases' | 'referrals';

export interface LeaderboardEntry {
  place: number;
  userId: string;
  name: string;
  avatar: string | null;
  level: number;
  value: number;
  isMe: boolean;
}

export interface LeaderboardDto {
  metric: LeaderboardMetric;
  entries: LeaderboardEntry[];
  me: LeaderboardEntry | null;
}

export interface TransactionDto {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  balanceAfter: number;
  description: string | null;
  createdAt: string;
}

export interface WinFeedItem {
  id: string;
  user: { name: string; avatar: string | null; level: number };
  caseName: string;
  caseImage: string;
  amount: number;
  rarity: Rarity;
  createdAt: string;
}

export interface DepositDto {
  id: string;
  amount: number;
  bonusAmount: number;
  bonusPercent: number;
  status: DepositStatus;
  payUrl: string | null;
  provider: string;
  createdAt: string;
}

export interface WithdrawalDto {
  id: string;
  amount: number;
  fee: number;
  payout: number;
  method: string;
  requisites: string;
  status: WithdrawalStatus;
  comment: string | null;
  createdAt: string;
}

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface AdminStatsDto {
  users: { total: number; activeToday: number; newToday: number; banned: number };
  cases: { opened: number; openedToday: number; wagered: number; paidOut: number; margin: number };
  finance: { deposits: number; depositsToday: number; withdrawalsPaid: number; withdrawalsPending: number };
  bonuses: { granted: number; promoGranted: number; referralGranted: number };
  topCases: Array<{ id: string; name: string; opened: number; margin: number }>;
}

export interface AdminUserDto {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  balance: number;
  level: number;
  isAdmin: boolean;
  isBanned: boolean;
  casesOpened: number;
  totalWon: number;
  totalDeposited: number;
  createdAt: string;
  lastSeenAt: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

/** Сообщения WebSocket-канала живой ленты. */
export type RealtimeEvent =
  | { type: 'win'; payload: WinFeedItem }
  | { type: 'online'; payload: { count: number } }
  | { type: 'hello'; payload: { serverTime: string } };
