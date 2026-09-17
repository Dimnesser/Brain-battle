/**
 * Наполнение базы стартовым контентом: кейсы, награды, промокоды и админ.
 * Запуск: npm run db:seed
 * Скрипт идемпотентен — повторный запуск обновляет существующие записи.
 */
import { PrismaClient, type CaseCategory, type Rarity } from '@prisma/client';
import { config as loadEnv } from 'dotenv';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

loadEnv({ path: resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

interface RewardSeed {
  name: string;
  amount: number;
  image: string;
  rarity: Rarity;
  probability: number;
}

interface CaseSeed {
  slug: string;
  name: string;
  description: string;
  image: string;
  accent: string;
  price: number;
  category: CaseCategory;
  sortOrder: number;
  cooldownSeconds?: number;
  rewards: RewardSeed[];
}

const CASES: CaseSeed[] = [
  {
    slug: 'daily-free',
    name: 'DAILY DROP',
    description: 'Бесплатный кейс раз в 24 часа',
    image: '🎁',
    accent: 'emerald',
    price: 0,
    category: 'FREE',
    sortOrder: 0,
    cooldownSeconds: 24 * 60 * 60,
    rewards: [
      { name: '10 B', amount: 10, image: '🪙', rarity: 'COMMON', probability: 45 },
      { name: '25 B', amount: 25, image: '🪙', rarity: 'COMMON', probability: 30 },
      { name: '50 B', amount: 50, image: '💠', rarity: 'RARE', probability: 15 },
      { name: '150 B', amount: 150, image: '💎', rarity: 'EPIC', probability: 8 },
      { name: '500 B', amount: 500, image: '👑', rarity: 'LEGENDARY', probability: 2 },
    ],
  },
  {
    slug: 'cyber-case',
    name: 'CYBER CASE',
    description: 'Классика для старта: частые награды, редкий джекпот',
    image: '🤖',
    accent: 'cyan',
    price: 100,
    category: 'POPULAR',
    sortOrder: 1,
    rewards: [
      { name: '10 B', amount: 10, image: '🪙', rarity: 'COMMON', probability: 26.2 },
      { name: '25 B', amount: 25, image: '🪙', rarity: 'COMMON', probability: 25 },
      { name: '50 B', amount: 50, image: '💠', rarity: 'RARE', probability: 15 },
      { name: '100 B', amount: 100, image: '💠', rarity: 'RARE', probability: 10 },
      { name: '500 B', amount: 500, image: '💎', rarity: 'EPIC', probability: 4 },
      { name: '1 000 B', amount: 1000, image: '👑', rarity: 'LEGENDARY', probability: 1.2 },
      { name: '10 000 B', amount: 10_000, image: '🌌', rarity: 'MYTHIC', probability: 0.15 },
    ],
  },
  {
    slug: 'night-city',
    name: 'NIGHT CITY',
    description: 'Неоновый кейс с повышенным средним выигрышем',
    image: '⚡',
    accent: 'violet',
    price: 50,
    category: 'POPULAR',
    sortOrder: 2,
    rewards: [
      { name: '5 B', amount: 5, image: '🪙', rarity: 'COMMON', probability: 47 },
      { name: '15 B', amount: 15, image: '🪙', rarity: 'COMMON', probability: 28 },
      { name: '40 B', amount: 40, image: '💠', rarity: 'RARE', probability: 18 },
      { name: '120 B', amount: 120, image: '💠', rarity: 'RARE', probability: 8 },
      { name: '600 B', amount: 600, image: '💎', rarity: 'EPIC', probability: 2.2 },
      { name: '5 000 B', amount: 5000, image: '👑', rarity: 'LEGENDARY', probability: 0.2 },
    ],
  },
  {
    slug: 'neon-case',
    name: 'NEON CASE',
    description: 'Баланс риска и награды для среднего уровня',
    image: '🌆',
    accent: 'fuchsia',
    price: 250,
    category: 'REGULAR',
    sortOrder: 3,
    rewards: [
      { name: '25 B', amount: 25, image: '🪙', rarity: 'COMMON', probability: 18.3 },
      { name: '75 B', amount: 75, image: '🪙', rarity: 'COMMON', probability: 27 },
      { name: '200 B', amount: 200, image: '💠', rarity: 'RARE', probability: 18 },
      { name: '450 B', amount: 450, image: '💎', rarity: 'EPIC', probability: 9 },
      { name: '1 500 B', amount: 1500, image: '💎', rarity: 'EPIC', probability: 2.5 },
      { name: '15 000 B', amount: 15_000, image: '🌌', rarity: 'MYTHIC', probability: 0.2 },
    ],
  },
  {
    slug: 'galaxy-case',
    name: 'GALAXY CASE',
    description: 'Космический риск: редкие, но крупные награды',
    image: '🌌',
    accent: 'indigo',
    price: 500,
    category: 'REGULAR',
    sortOrder: 4,
    rewards: [
      { name: '50 B', amount: 50, image: '🪙', rarity: 'COMMON', probability: 19.7 },
      { name: '150 B', amount: 150, image: '🪙', rarity: 'COMMON', probability: 26 },
      { name: '400 B', amount: 400, image: '💠', rarity: 'RARE', probability: 18 },
      { name: '900 B', amount: 900, image: '💎', rarity: 'EPIC', probability: 9 },
      { name: '3 000 B', amount: 3000, image: '👑', rarity: 'LEGENDARY', probability: 2.5 },
      { name: '25 000 B', amount: 25_000, image: '🌠', rarity: 'MYTHIC', probability: 0.25 },
    ],
  },
  {
    slug: 'inferno-case',
    name: 'INFERNO CASE',
    description: 'Высокая ставка — высокий разброс наград',
    image: '🔥',
    accent: 'amber',
    price: 1500,
    category: 'PREMIUM',
    sortOrder: 5,
    rewards: [
      { name: '150 B', amount: 150, image: '🪙', rarity: 'COMMON', probability: 18.7 },
      { name: '500 B', amount: 500, image: '💠', rarity: 'RARE', probability: 26 },
      { name: '1 200 B', amount: 1200, image: '💠', rarity: 'RARE', probability: 16 },
      { name: '3 000 B', amount: 3000, image: '💎', rarity: 'EPIC', probability: 8 },
      { name: '10 000 B', amount: 10_000, image: '👑', rarity: 'LEGENDARY', probability: 2.2 },
      { name: '75 000 B', amount: 75_000, image: '🌠', rarity: 'MYTHIC', probability: 0.2 },
    ],
  },
  {
    slug: 'legend-case',
    name: 'LEGEND CASE',
    description: 'Максимальные награды платформы',
    image: '👑',
    accent: 'rose',
    price: 5000,
    category: 'PREMIUM',
    sortOrder: 6,
    rewards: [
      { name: '500 B', amount: 500, image: '🪙', rarity: 'COMMON', probability: 14.2 },
      { name: '1 500 B', amount: 1500, image: '💠', rarity: 'RARE', probability: 27 },
      { name: '4 000 B', amount: 4000, image: '💎', rarity: 'EPIC', probability: 17 },
      { name: '9 000 B', amount: 9000, image: '💎', rarity: 'EPIC', probability: 8 },
      { name: '30 000 B', amount: 30_000, image: '👑', rarity: 'LEGENDARY', probability: 2.4 },
      { name: '250 000 B', amount: 250_000, image: '🌠', rarity: 'MYTHIC', probability: 0.2 },
    ],
  },
];

const PROMOS = [
  { code: 'WELCOME', type: 'BALANCE' as const, amount: 150, description: 'Приветственный бонус', perUserLimit: 1, maxActivations: null },
  { code: 'BONUS100', type: 'BALANCE' as const, amount: 100, description: 'Разовый бонус 100 B', perUserLimit: 1, maxActivations: 1000 },
  { code: 'SUMMER', type: 'DEPOSIT_PERCENT' as const, amount: 10, description: '+10% к следующему пополнению', perUserLimit: 1, maxActivations: null },
  { code: 'NEXUSXP', type: 'XP' as const, amount: 250, description: '+250 XP', perUserLimit: 1, maxActivations: 500 },
];

function referralCode(): string {
  return randomBytes(6).toString('base64url').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8).padEnd(8, 'X');
}

/** Средняя отдача кейса — полезно видеть при изменении вероятностей. */
function expectedReturn(rewards: RewardSeed[]): number {
  const total = rewards.reduce((sum, reward) => sum + reward.probability, 0);
  if (total <= 0) return 0;
  return rewards.reduce((sum, reward) => sum + (reward.probability / total) * reward.amount, 0);
}

async function seedCases(): Promise<void> {
  for (const item of CASES) {
    const created = await prisma.case.upsert({
      where: { slug: item.slug },
      create: {
        slug: item.slug,
        name: item.name,
        description: item.description,
        image: item.image,
        accent: item.accent,
        price: item.price,
        category: item.category,
        sortOrder: item.sortOrder,
        cooldownSeconds: item.cooldownSeconds ?? null,
        isActive: true,
      },
      update: {
        name: item.name,
        description: item.description,
        image: item.image,
        accent: item.accent,
        price: item.price,
        category: item.category,
        sortOrder: item.sortOrder,
        cooldownSeconds: item.cooldownSeconds ?? null,
        isActive: true,
      },
    });

    // Награды пересоздаём целиком: так вероятности всегда соответствуют сидам
    await prisma.caseReward.deleteMany({ where: { caseId: created.id } });
    await prisma.caseReward.createMany({
      data: item.rewards.map((reward) => ({ ...reward, caseId: created.id })),
    });

    const rtp = item.price > 0 ? ((expectedReturn(item.rewards) / item.price) * 100).toFixed(1) : '∞';
    console.log(`  ✔ ${item.image} ${item.name} — ${item.rewards.length} наград, RTP ${rtp}%`);
  }
}

async function seedPromos(): Promise<void> {
  for (const promo of PROMOS) {
    await prisma.promoCode.upsert({
      where: { code: promo.code },
      create: {
        code: promo.code,
        type: promo.type,
        amount: promo.amount,
        description: promo.description,
        perUserLimit: promo.perUserLimit,
        maxActivations: promo.maxActivations,
        isActive: true,
      },
      update: { amount: promo.amount, description: promo.description, isActive: true },
    });
    console.log(`  ✔ промокод ${promo.code}`);
  }
}

async function seedAdmin(): Promise<void> {
  const ids = (process.env.ADMIN_TELEGRAM_ID ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter((v) => /^\d+$/.test(v));

  if (ids.length === 0) {
    console.log('  ⚠ ADMIN_TELEGRAM_ID не задан — админ не создан');
    return;
  }

  for (const id of ids) {
    const telegramId = BigInt(id);
    const existing = await prisma.user.findUnique({ where: { telegramId } });

    if (existing) {
      await prisma.user.update({ where: { id: existing.id }, data: { isAdmin: true } });
      console.log(`  ✔ права администратора выданы ${id}`);
      continue;
    }

    await prisma.user.create({
      data: {
        telegramId,
        username: `admin_${id.slice(-4)}`,
        firstName: 'Администратор',
        referralCode: referralCode(),
        isAdmin: true,
        balance: 10_000,
      },
    });
    console.log(`  ✔ создан администратор ${id}`);
  }
}

async function main(): Promise<void> {
  console.log('▶ Наполнение базы NEXUS');

  console.log('\n• Кейсы');
  await seedCases();

  console.log('\n• Промокоды');
  await seedPromos();

  console.log('\n• Администраторы');
  await seedAdmin();

  const [cases, rewards, promos] = await Promise.all([
    prisma.case.count(),
    prisma.caseReward.count(),
    prisma.promoCode.count(),
  ]);

  console.log(`\n✅ Готово: ${cases} кейсов, ${rewards} наград, ${promos} промокодов`);
}

main()
  .catch((error) => {
    console.error('❌ Ошибка seed:', error);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
