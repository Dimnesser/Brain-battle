/**
 * Наполнение базы стартовым контентом: кейсы, награды, промокоды и админ.
 * Запуск: npm run db:seed
 * Скрипт идемпотентен — повторный запуск обновляет существующие записи.
 *
 * Тематика — Steal a Brainrot (Roblox): тиры редкости повторяют игровые
 * (Common → Rare → Epic → Legendary → Mythic → Brainrot God → Secret → OG),
 * а кейсы собраны вокруг механик игры: конвейер, кражи с чужих баз,
 * мутации (Gold ×1.25, Diamond ×1.5, Rainbow ×10, Crystal ×13) и ивент-мутации.
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
    slug: 'konveyer',
    name: 'КОНВЕЙЕР',
    description: 'Лента конвейера раз в 24 часа: что выехало — то твоё',
    image: '📦',
    accent: 'emerald',
    price: 0,
    category: 'FREE',
    sortOrder: 0,
    cooldownSeconds: 24 * 60 * 60,
    rewards: [
      { name: 'Noobini Pizzanini', amount: 10, image: '🍕', rarity: 'COMMON', probability: 40 },
      { name: 'Tim Cheese', amount: 25, image: '🧀', rarity: 'COMMON', probability: 27 },
      { name: 'Pipi Corni', amount: 40, image: '🌽', rarity: 'COMMON', probability: 18 },
      { name: 'Trippi Troppi', amount: 80, image: '🦐', rarity: 'RARE', probability: 9 },
      { name: 'Boneca Ambalabu', amount: 160, image: '🐸', rarity: 'RARE', probability: 5 },
      { name: 'Cappuccino Assassino', amount: 500, image: '☕', rarity: 'EPIC', probability: 1 },
    ],
  },
  {
    slug: 'pervaya-baza',
    name: 'ПЕРВАЯ БАЗА',
    description: 'Стартовый набор для первой базы: дёшево и часто',
    image: '🏠',
    accent: 'emerald',
    price: 25,
    category: 'REGULAR',
    sortOrder: 1,
    rewards: [
      { name: 'Noobini Pizzanini', amount: 4, image: '🍕', rarity: 'COMMON', probability: 49.39 },
      { name: 'Tim Cheese', amount: 10, image: '🧀', rarity: 'COMMON', probability: 26 },
      { name: 'Pipi Corni', amount: 20, image: '🌽', rarity: 'COMMON', probability: 20 },
      { name: 'Fluriflura', amount: 40, image: '🦋', rarity: 'COMMON', probability: 12 },
      { name: 'Trippi Troppi', amount: 75, image: '🦐', rarity: 'RARE', probability: 6 },
      { name: 'Boneca Ambalabu', amount: 180, image: '🐸', rarity: 'RARE', probability: 2.2 },
      { name: 'Cappuccino Assassino', amount: 380, image: '☕', rarity: 'EPIC', probability: 0.7 },
      { name: 'Ballerina Cappuccina', amount: 950, image: '🩰', rarity: 'LEGENDARY', probability: 0.18 },
    ],
  },
  {
    slug: 'nochnaya-krazha',
    name: 'НОЧНАЯ КРАЖА',
    description: 'Выносим чужую базу, пока хозяин в офлайне',
    image: '🌙',
    accent: 'violet',
    price: 120,
    category: 'POPULAR',
    sortOrder: 2,
    rewards: [
      { name: 'Tim Cheese', amount: 20, image: '🧀', rarity: 'COMMON', probability: 47.75 },
      { name: 'Svinina Bombardino', amount: 50, image: '🐷', rarity: 'COMMON', probability: 26 },
      { name: 'Trippi Troppi', amount: 95, image: '🦐', rarity: 'RARE', probability: 20 },
      { name: 'Pinealotto Fruttarino', amount: 180, image: '🍍', rarity: 'RARE', probability: 12 },
      { name: 'Bombardiro Crocodilo', amount: 360, image: '✈️', rarity: 'EPIC', probability: 6 },
      { name: 'Ballerina Cappuccina', amount: 840, image: '🩰', rarity: 'LEGENDARY', probability: 2.2 },
      { name: 'Chimpanzini Bananini', amount: 1800, image: '🐒', rarity: 'LEGENDARY', probability: 0.7 },
      { name: 'Tung Tung Tung Sahur', amount: 4550, image: '🥁', rarity: 'BRAINROT_GOD', probability: 0.18 },
    ],
  },
  {
    slug: 'zolotaya-mutaciya',
    name: 'ЗОЛОТАЯ ЖИЛА',
    description: 'Мутация Gold ×1.25 — самая частая, но всегда в цене',
    image: '🪙',
    accent: 'amber',
    price: 300,
    category: 'POPULAR',
    sortOrder: 3,
    rewards: [
      { name: 'Золотой Tim Cheese', amount: 45, image: '🧀', rarity: 'COMMON', probability: 46.44 },
      { name: 'Золотой Trippi Troppi', amount: 120, image: '🦐', rarity: 'RARE', probability: 26 },
      { name: 'Золотой Boneca Ambalabu', amount: 240, image: '🐸', rarity: 'RARE', probability: 20 },
      { name: 'Золотой Cappuccino Assassino', amount: 450, image: '☕', rarity: 'EPIC', probability: 12 },
      { name: 'Золотой Bombardiro Crocodilo', amount: 900, image: '✈️', rarity: 'EPIC', probability: 6 },
      { name: 'Золотой Chimpanzini Bananini', amount: 2100, image: '🐒', rarity: 'LEGENDARY', probability: 2.2 },
      { name: 'Золотой Glorbo Fruttodrillo', amount: 4500, image: '🍉', rarity: 'LEGENDARY', probability: 0.7 },
      { name: 'Золотой Cocofanto Elefanto', amount: 11500, image: '🐘', rarity: 'BRAINROT_GOD', probability: 0.18 },
    ],
  },
  {
    slug: 'italyanskiy-kvartal',
    name: 'ИТАЛЬЯНСКИЙ КВАРТАЛ',
    description: 'Те самые итальянцы, с которых всё начиналось',
    image: '🍝',
    accent: 'rose',
    price: 450,
    category: 'THEMATIC',
    sortOrder: 4,
    rewards: [
      { name: 'Svinina Bombardino', amount: 70, image: '🐷', rarity: 'COMMON', probability: 46.83 },
      { name: 'Trulimero Trulicina', amount: 180, image: '🐟', rarity: 'RARE', probability: 26 },
      { name: 'Cappuccino Assassino', amount: 360, image: '☕', rarity: 'EPIC', probability: 20 },
      { name: 'Lirilì Larilà', amount: 680, image: '🌵', rarity: 'EPIC', probability: 12 },
      { name: 'Frigo Camelo', amount: 1350, image: '🧊', rarity: 'EPIC', probability: 6 },
      { name: 'Burbaloni Luliloli', amount: 3150, image: '🥥', rarity: 'LEGENDARY', probability: 2.2 },
      { name: 'Chef Crabracadabra', amount: 6750, image: '🦀', rarity: 'LEGENDARY', probability: 0.7 },
      { name: 'Tralalero Tralala', amount: 17000, image: '🦈', rarity: 'MYTHIC', probability: 0.18 },
    ],
  },
  {
    slug: 'almaznaya-mutaciya',
    name: 'АЛМАЗНАЯ ГРАНЬ',
    description: 'Мутация Diamond ×1.5 — редкая ступень после золота',
    image: '💎',
    accent: 'cyan',
    price: 700,
    category: 'POPULAR',
    sortOrder: 5,
    rewards: [
      { name: 'Алмазный Trippi Troppi', amount: 100, image: '🦐', rarity: 'RARE', probability: 45.89 },
      { name: 'Алмазный Cappuccino Assassino', amount: 280, image: '☕', rarity: 'EPIC', probability: 26 },
      { name: 'Алмазный Bombardiro Crocodilo', amount: 560, image: '✈️', rarity: 'EPIC', probability: 20 },
      { name: 'Алмазная Ballerina Cappuccina', amount: 1050, image: '🩰', rarity: 'LEGENDARY', probability: 12 },
      { name: 'Алмазный Blueberrinni Octopusini', amount: 2100, image: '🫐', rarity: 'LEGENDARY', probability: 6 },
      { name: 'Алмазный Orcalero Orcala', amount: 4900, image: '🐋', rarity: 'MYTHIC', probability: 2.2 },
      { name: 'Алмазный Girafa Celestre', amount: 10500, image: '🦒', rarity: 'BRAINROT_GOD', probability: 0.7 },
      { name: 'Алмазный Graipuss Medussi', amount: 26500, image: '🐙', rarity: 'SECRET', probability: 0.18 },
    ],
  },
  {
    slug: 'noch-sahura',
    name: 'НОЧЬ САХУРА',
    description: 'Барабан звучит — значит, кто-то уже потерял базу',
    image: '🥁',
    accent: 'indigo',
    price: 900,
    category: 'THEMATIC',
    sortOrder: 6,
    rewards: [
      { name: 'Talpa Di Fero', amount: 140, image: '🦫', rarity: 'COMMON', probability: 46.65 },
      { name: 'Brr Brr Patapim', amount: 360, image: '🌳', rarity: 'RARE', probability: 26 },
      { name: 'Mummio Rappitto', amount: 720, image: '🧟', rarity: 'EPIC', probability: 20 },
      { name: 'Chimpanzini Bananini', amount: 1350, image: '🐒', rarity: 'LEGENDARY', probability: 12 },
      { name: 'Caramello', amount: 2700, image: '🍬', rarity: 'LEGENDARY', probability: 6 },
      { name: 'Matteo', amount: 6300, image: '🧑', rarity: 'MYTHIC', probability: 2.2 },
      { name: 'Tung Tung Tung Sahur', amount: 13500, image: '🥁', rarity: 'BRAINROT_GOD', probability: 0.7 },
      { name: 'Job Job Job Sahur', amount: 34000, image: '💼', rarity: 'SECRET', probability: 0.18 },
    ],
  },
  {
    slug: 'glubina',
    name: 'ГЛУБИНА',
    description: 'Всё, что выплывает со дна конвейера',
    image: '🌊',
    accent: 'cyan',
    price: 1400,
    category: 'THEMATIC',
    sortOrder: 7,
    rewards: [
      { name: 'Trulimero Trulicina', amount: 210, image: '🐟', rarity: 'RARE', probability: 45.94 },
      { name: 'Chef Crabracadabra', amount: 560, image: '🦀', rarity: 'LEGENDARY', probability: 26 },
      { name: 'Blueberrinni Octopusini', amount: 1100, image: '🫐', rarity: 'LEGENDARY', probability: 20 },
      { name: 'Tralalero Tralala', amount: 2100, image: '🦈', rarity: 'MYTHIC', probability: 12 },
      { name: 'Orcalero Orcala', amount: 4200, image: '🐋', rarity: 'MYTHIC', probability: 6 },
      { name: 'Los Tralaleritos', amount: 9800, image: '🦈', rarity: 'BRAINROT_GOD', probability: 2.2 },
      { name: 'Graipuss Medussi', amount: 21000, image: '🐙', rarity: 'SECRET', probability: 0.7 },
      { name: 'Spaghetti Tualetti', amount: 53000, image: '🍝', rarity: 'SECRET', probability: 0.18 },
    ],
  },
  {
    slug: 'raduzhnyy-sboy',
    name: 'РАДУЖНЫЙ СБОЙ',
    description: 'Мутация Rainbow ×10 — сбой, за которым охотятся все',
    image: '🌈',
    accent: 'fuchsia',
    price: 1800,
    category: 'POPULAR',
    sortOrder: 8,
    rewards: [
      { name: 'Радужный Boneca Ambalabu', amount: 270, image: '🐸', rarity: 'RARE', probability: 46.36 },
      { name: 'Радужный Lirilì Larilà', amount: 720, image: '🌵', rarity: 'EPIC', probability: 26 },
      { name: 'Радужная Ballerina Cappuccina', amount: 1450, image: '🩰', rarity: 'LEGENDARY', probability: 20 },
      { name: 'Радужный Tralalero Tralala', amount: 2700, image: '🦈', rarity: 'MYTHIC', probability: 12 },
      { name: 'Радужный Bombombini Gusini', amount: 5400, image: '🦢', rarity: 'MYTHIC', probability: 6 },
      { name: 'Радужный Tung Tung Tung Sahur', amount: 12500, image: '🥁', rarity: 'BRAINROT_GOD', probability: 2.2 },
      { name: 'Радужный Odin Din Din Dun', amount: 27000, image: '⚡', rarity: 'BRAINROT_GOD', probability: 0.7 },
      { name: 'Радужный Garama and Madundung', amount: 68500, image: '🗿', rarity: 'SECRET', probability: 0.18 },
    ],
  },
  {
    slug: 'bozhestvo-rota',
    name: 'БОЖЕСТВО РОТА',
    description: 'Тир Brainrot God: имя объявляют на весь сервер',
    image: '👑',
    accent: 'violet',
    price: 3500,
    category: 'PREMIUM',
    sortOrder: 9,
    rewards: [
      { name: 'Matteo', amount: 520, image: '🧑', rarity: 'MYTHIC', probability: 46.41 },
      { name: 'Bombombini Gusini', amount: 1400, image: '🦢', rarity: 'MYTHIC', probability: 26 },
      { name: 'Cocofanto Elefanto', amount: 2800, image: '🐘', rarity: 'BRAINROT_GOD', probability: 20 },
      { name: 'Girafa Celestre', amount: 5250, image: '🦒', rarity: 'BRAINROT_GOD', probability: 12 },
      { name: 'Tenini Ballini', amount: 10500, image: '🎾', rarity: 'BRAINROT_GOD', probability: 6 },
      { name: 'Pretzo Robo', amount: 24500, image: '🥨', rarity: 'BRAINROT_GOD', probability: 2.2 },
      { name: 'Odin Din Din Dun', amount: 52500, image: '⚡', rarity: 'BRAINROT_GOD', probability: 0.7 },
      { name: 'La Vacca Saturno Saturnita', amount: 135000, image: '🐄', rarity: 'SECRET', probability: 0.18 },
    ],
  },
  {
    slug: 'admin-ivent',
    name: 'АДМИН-ИВЕНТ',
    description: 'Ушедшие ивент-мутации: Bloodrot ×2, Candy ×4, Lava ×6',
    image: '⚡',
    accent: 'rose',
    price: 5000,
    category: 'THEMATIC',
    sortOrder: 10,
    rewards: [
      { name: 'Bloodrot Trippi Troppi', amount: 750, image: '🩸', rarity: 'RARE', probability: 46.36 },
      { name: 'Lava Bombardiro Crocodilo', amount: 2000, image: '🌋', rarity: 'EPIC', probability: 26 },
      { name: 'Candy Chimpanzini Bananini', amount: 4000, image: '🍬', rarity: 'LEGENDARY', probability: 20 },
      { name: 'Candy Ballerina Cappuccina', amount: 7500, image: '🍭', rarity: 'LEGENDARY', probability: 12 },
      { name: 'Lava Tralalero Tralala', amount: 15000, image: '🦈', rarity: 'MYTHIC', probability: 6 },
      { name: 'Bloodrot Tung Tung Tung Sahur', amount: 35000, image: '🥁', rarity: 'BRAINROT_GOD', probability: 2.2 },
      { name: 'Bloodrot Los Tralaleritos', amount: 75000, image: '🩸', rarity: 'BRAINROT_GOD', probability: 0.7 },
      { name: 'Lava Nuclearo Dinossauro', amount: 190000, image: '☢️', rarity: 'SECRET', probability: 0.18 },
    ],
  },
  {
    slug: 'sekretnyy-arhiv',
    name: 'СЕКРЕТНЫЙ АРХИВ',
    description: 'Только Secret-тир — самая редкая ступень игры',
    image: '🗝',
    accent: 'indigo',
    price: 9000,
    category: 'PREMIUM',
    sortOrder: 11,
    rewards: [
      { name: 'Los Tralaleritos', amount: 1350, image: '🦈', rarity: 'BRAINROT_GOD', probability: 46.3 },
      { name: 'Chimpanzini Spiderini', amount: 3600, image: '🕷', rarity: 'SECRET', probability: 26 },
      { name: 'Agarrini la Palini', amount: 7200, image: '🎈', rarity: 'SECRET', probability: 20 },
      { name: 'Esok Sekolah', amount: 13500, image: '🎒', rarity: 'SECRET', probability: 12 },
      { name: 'Nuclearo Dinossauro', amount: 27000, image: '☢️', rarity: 'SECRET', probability: 6 },
      { name: 'Dragon Cannelloni', amount: 63000, image: '🐉', rarity: 'SECRET', probability: 2.2 },
      { name: 'Los Combinasionas', amount: 135000, image: '🌀', rarity: 'SECRET', probability: 0.7 },
      { name: 'La Grande Combinasion', amount: 340000, image: '🌌', rarity: 'SECRET', probability: 0.18 },
    ],
  },
  {
    slug: 'kristall-13x',
    name: 'КРИСТАЛЛ 13X',
    description: 'Мутация Crystal ×13 — лучший множитель в игре',
    image: '🔮',
    accent: 'fuchsia',
    price: 20000,
    category: 'PREMIUM',
    sortOrder: 12,
    rewards: [
      { name: 'Кристальный Tralalero Tralala', amount: 3000, image: '🦈', rarity: 'MYTHIC', probability: 46.36 },
      { name: 'Кристальный Tung Tung Tung Sahur', amount: 8000, image: '🥁', rarity: 'BRAINROT_GOD', probability: 26 },
      { name: 'Кристальный Girafa Celestre', amount: 16000, image: '🦒', rarity: 'BRAINROT_GOD', probability: 20 },
      { name: 'Кристальная La Vacca Saturno Saturnita', amount: 30000, image: '🐄', rarity: 'SECRET', probability: 12 },
      { name: 'Кристальный Graipuss Medussi', amount: 60000, image: '🐙', rarity: 'SECRET', probability: 6 },
      { name: 'Кристальный Dragon Cannelloni', amount: 140000, image: '🐉', rarity: 'SECRET', probability: 2.2 },
      { name: 'Кристальный Garama and Madundung', amount: 300000, image: '🗿', rarity: 'SECRET', probability: 0.7 },
      { name: 'Кристальный Skibidi Toilet', amount: 760000, image: '🚽', rarity: 'OG', probability: 0.18 },
    ],
  },
  {
    slug: 'og-hranilishche',
    name: 'OG ХРАНИЛИЩЕ',
    description: 'OG-тир: те, кого больше не выбить с конвейера',
    image: '🏛',
    accent: 'amber',
    price: 50000,
    category: 'PREMIUM',
    sortOrder: 13,
    rewards: [
      { name: 'Graipuss Medussi', amount: 7500, image: '🐙', rarity: 'SECRET', probability: 46.36 },
      { name: 'Garama and Madundung', amount: 20000, image: '🗿', rarity: 'SECRET', probability: 26 },
      { name: 'Dragon Cannelloni', amount: 40000, image: '🐉', rarity: 'SECRET', probability: 20 },
      { name: 'La Grande Combinasion', amount: 75000, image: '🌌', rarity: 'SECRET', probability: 12 },
      { name: 'Skibidi Toilet', amount: 150000, image: '🚽', rarity: 'OG', probability: 6 },
      { name: 'Meowl', amount: 350000, image: '🦉', rarity: 'OG', probability: 2.2 },
      { name: 'Strawberry Elephant', amount: 750000, image: '🍓', rarity: 'OG', probability: 0.7 },
      { name: 'Spyder Elephant', amount: 1900000, image: '🕸', rarity: 'OG', probability: 0.18 },
    ],
  },
];

const PROMOS = [
  { code: 'WELCOME', type: 'BALANCE' as const, amount: 150, description: 'Приветственный бонус', perUserLimit: 1, maxActivations: null },
  { code: 'SAHUR', type: 'BALANCE' as const, amount: 100, description: 'Ночной бонус 100 B', perUserLimit: 1, maxActivations: 1000 },
  { code: 'RAINBOW', type: 'DEPOSIT_PERCENT' as const, amount: 10, description: '+10% к следующему пополнению', perUserLimit: 1, maxActivations: null },
  { code: 'OGDROP', type: 'XP' as const, amount: 250, description: '+250 XP', perUserLimit: 1, maxActivations: 500 },
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
    const jackpot = Math.max(...item.rewards.map((reward) => reward.amount));
    console.log(
      `  ✔ ${item.image} ${item.name.padEnd(20)} ${item.rewards.length} наград · RTP ${rtp}% · джекпот ${jackpot} B`,
    );
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

/** Кейс, у которого отдача выше 100%, работает в убыток — предупреждаем явно. */
function warnAboutEconomy(): void {
  const risky = CASES.filter((item) => item.price > 0 && expectedReturn(item.rewards) / item.price > 1);
  if (risky.length === 0) return;
  console.warn(`\n⚠ Кейсы с RTP выше 100%: ${risky.map((item) => item.name).join(', ')}`);
}

async function main(): Promise<void> {
  console.log('▶ Наполнение базы NEXUS (Steal a Brainrot)');

  console.log('\n• Кейсы');
  await seedCases();

  console.log('\n• Промокоды');
  await seedPromos();

  console.log('\n• Администраторы');
  await seedAdmin();

  warnAboutEconomy();

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
