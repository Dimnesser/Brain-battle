import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/db.js';
import { createApp, createCase, login, resetDatabase, setBalance } from '../helpers.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createApp();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase();
});

describe('авторизация', () => {
  it('создаёт игрока и выдаёт стартовый бонус', async () => {
    const { user } = await login(app, 100001);
    expect(user.balance).toBe(250);

    const transactions = await prisma.transaction.findMany({ where: { userId: user.id } });
    expect(transactions).toHaveLength(1);
    expect(transactions[0]!.type).toBe('BONUS');
  });

  it('повторный вход не начисляет бонус второй раз', async () => {
    const first = await login(app, 100002);
    const second = await login(app, 100002);

    expect(second.user.id).toBe(first.user.id);
    expect(second.user.balance).toBe(250);
  });

  it('не принимает поддельный initData', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/telegram',
      payload: { initData: 'user=%7B%22id%22%3A1%7D&auth_date=1&hash=deadbeef' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('закрывает доступ заблокированному игроку', async () => {
    const { user, auth } = await login(app, 100003);
    await prisma.user.update({ where: { id: user.id }, data: { isBanned: true } });

    const response = await app.inject({ method: 'GET', url: '/api/user', headers: auth });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('BANNED');
  });

  it('требует токен для игровых маршрутов', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/cases' });
    expect(response.statusCode).toBe(401);
  });
});

describe('открытие кейса', () => {
  it('списывает цену и начисляет награду одной операцией', async () => {
    const item = await createCase({ price: 100, rewardAmount: 50 });
    const { user, auth } = await login(app, 100010);
    await setBalance(user.id, 1000);

    const response = await app.inject({ method: 'POST', url: `/api/cases/${item.slug}/open`, headers: auth });
    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.reward.amount).toBe(50);
    expect(body.balance).toBe(950); // 1000 - 100 + 50
    expect(body.opening.profit).toBe(-50);

    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fresh.balance).toBe(950);
    expect(fresh.casesOpened).toBe(1);
    expect(fresh.totalWon).toBe(50);
    expect(fresh.totalWagered).toBe(100);

    const types = (await prisma.transaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } }))
      .map((t) => t.type);
    expect(types).toContain('CASE_PURCHASE');
    expect(types).toContain('CASE_REWARD');
  });

  it('отдаёт ленту анимации, где победитель стоит на объявленной позиции', async () => {
    const item = await createCase({ slug: 'roll-case', price: 10, rewardAmount: 5 });
    const { user, auth } = await login(app, 100011);
    await setBalance(user.id, 100);

    const body = (
      await app.inject({ method: 'POST', url: `/api/cases/${item.slug}/open`, headers: auth })
    ).json();

    expect(body.roll.items.length).toBeGreaterThan(10);
    expect(body.roll.items[body.roll.winnerIndex].id).toBe(body.reward.id);
  });

  it('не даёт открыть кейс при нехватке средств', async () => {
    const item = await createCase({ price: 500 });
    const { user, auth } = await login(app, 100012);
    await setBalance(user.id, 100);

    const response = await app.inject({ method: 'POST', url: `/api/cases/${item.slug}/open`, headers: auth });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INSUFFICIENT_FUNDS');

    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fresh.balance).toBe(100);
    expect(await prisma.caseOpening.count()).toBe(0);
  });

  it('не открывает выключенный кейс', async () => {
    const item = await createCase({ slug: 'off-case', isActive: false });
    const { user, auth } = await login(app, 100013);
    await setBalance(user.id, 1000);

    const response = await app.inject({ method: 'POST', url: `/api/cases/${item.slug}/open`, headers: auth });
    expect(response.statusCode).toBe(422);
  });

  it('при параллельных запросах списывает баланс ровно один раз', async () => {
    // Баланса хватает ровно на одно открытие: классическая гонка,
    // при которой наивная проверка «сначала прочитать, потом списать» уводит баланс в минус
    const item = await createCase({ slug: 'race-case', price: 100, rewardAmount: 10 });
    const { user, auth } = await login(app, 100014);
    await setBalance(user.id, 100);

    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        app.inject({ method: 'POST', url: `/api/cases/${item.slug}/open`, headers: auth }),
      ),
    );

    const ok = responses.filter((r) => r.statusCode === 200);
    const rejected = responses.filter((r) => r.json()?.error?.code === 'INSUFFICIENT_FUNDS');

    expect(ok).toHaveLength(1);
    expect(rejected).toHaveLength(7);

    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fresh.balance).toBe(10); // 100 - 100 + 10
    expect(fresh.balance).toBeGreaterThanOrEqual(0);
    expect(await prisma.caseOpening.count({ where: { userId: user.id } })).toBe(1);
  });
});

describe('бесплатный кейс', () => {
  it('открывается один раз, затем уходит в кулдаун', async () => {
    const item = await createCase({ slug: 'free-case', price: 0, rewardAmount: 25, cooldownSeconds: 86_400 });
    const { auth } = await login(app, 100020);

    const first = await app.inject({ method: 'POST', url: `/api/cases/${item.slug}/open`, headers: auth });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({ method: 'POST', url: `/api/cases/${item.slug}/open`, headers: auth });
    expect(second.statusCode).toBe(429);
    expect(second.json().error.code).toBe('COOLDOWN');
    expect(second.json().error.details.availableInSeconds).toBeGreaterThan(86_000);
  });

  it('не открывается дважды при параллельных запросах', async () => {
    const item = await createCase({ slug: 'free-race', price: 0, rewardAmount: 25, cooldownSeconds: 86_400 });
    const { auth } = await login(app, 100021);

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        app.inject({ method: 'POST', url: `/api/cases/${item.slug}/open`, headers: auth }),
      ),
    );

    expect(responses.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(await prisma.caseOpening.count()).toBe(1);
  });

  it('снова доступен после истечения кулдауна', async () => {
    const item = await createCase({ slug: 'free-expired', price: 0, rewardAmount: 25, cooldownSeconds: 3600 });
    const { user, auth } = await login(app, 100022);

    await app.inject({ method: 'POST', url: `/api/cases/${item.slug}/open`, headers: auth });

    // Отматываем открытие на два часа назад
    await prisma.caseOpening.updateMany({
      where: { userId: user.id },
      data: { createdAt: new Date(Date.now() - 2 * 3600 * 1000) },
    });

    const again = await app.inject({ method: 'POST', url: `/api/cases/${item.slug}/open`, headers: auth });
    expect(again.statusCode).toBe(200);
  });
});

describe('бонусы', () => {
  it('ежедневный бонус выдаётся один раз в сутки', async () => {
    const { user, auth } = await login(app, 100030);

    const first = await app.inject({
      method: 'POST',
      url: '/api/bonus/claim',
      headers: auth,
      payload: { type: 'DAILY' },
    });
    expect(first.statusCode).toBe(200);
    const amount = first.json().amount;
    expect(amount).toBeGreaterThan(0);

    const second = await app.inject({
      method: 'POST',
      url: '/api/bonus/claim',
      headers: auth,
      payload: { type: 'DAILY' },
    });
    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe('ALREADY_CLAIMED');

    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fresh.balance).toBe(250 + amount);
  });

  it('параллельные запросы не удваивают бонус', async () => {
    const { user, auth } = await login(app, 100031);

    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        app.inject({ method: 'POST', url: '/api/bonus/claim', headers: auth, payload: { type: 'DAILY' } }),
      ),
    );

    expect(responses.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(await prisma.bonusClaim.count({ where: { userId: user.id } })).toBe(1);
  });

  it('не выдаёт награду за незавершённую серию входов', async () => {
    const { auth } = await login(app, 100032);
    const response = await app.inject({
      method: 'POST',
      url: '/api/bonus/claim',
      headers: auth,
      payload: { type: 'STREAK' },
    });

    expect(response.statusCode).toBe(422);
  });
});

describe('промокоды', () => {
  it('начисляет монеты и не даёт активировать повторно', async () => {
    await prisma.promoCode.create({ data: { code: 'TESTPROMO', type: 'BALANCE', amount: 500, perUserLimit: 1 } });
    const { user, auth } = await login(app, 100040);

    const first = await app.inject({
      method: 'POST',
      url: '/api/promo/redeem',
      headers: auth,
      payload: { code: 'testpromo' }, // регистр не важен
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().amount).toBe(500);

    const second = await app.inject({
      method: 'POST',
      url: '/api/promo/redeem',
      headers: auth,
      payload: { code: 'TESTPROMO' },
    });
    expect(second.statusCode).toBe(409);

    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fresh.balance).toBe(750);
  });

  it('соблюдает общий лимит активаций', async () => {
    await prisma.promoCode.create({
      data: { code: 'LIMITED', type: 'BALANCE', amount: 100, maxActivations: 1, perUserLimit: 1 },
    });

    const first = await login(app, 100041);
    const second = await login(app, 100042);

    const a = await app.inject({
      method: 'POST',
      url: '/api/promo/redeem',
      headers: first.auth,
      payload: { code: 'LIMITED' },
    });
    const b = await app.inject({
      method: 'POST',
      url: '/api/promo/redeem',
      headers: second.auth,
      payload: { code: 'LIMITED' },
    });

    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(422);
    expect(await prisma.promoCodeUse.count()).toBe(1);
  });

  it('отклоняет несуществующий и выключенный промокод', async () => {
    await prisma.promoCode.create({
      data: { code: 'DISABLED', type: 'BALANCE', amount: 100, isActive: false },
    });
    const { auth } = await login(app, 100043);

    const unknown = await app.inject({
      method: 'POST',
      url: '/api/promo/redeem',
      headers: auth,
      payload: { code: 'NOSUCHCODE' },
    });
    const disabled = await app.inject({
      method: 'POST',
      url: '/api/promo/redeem',
      headers: auth,
      payload: { code: 'DISABLED' },
    });

    expect(unknown.statusCode).toBe(422);
    expect(disabled.statusCode).toBe(422);
  });
});

describe('рефералы', () => {
  it('начисляют бонус обеим сторонам и учитываются в статистике', async () => {
    const referrer = await login(app, 100050);
    const code = (await prisma.user.findUniqueOrThrow({ where: { id: referrer.user.id } })).referralCode;

    const referee = await login(app, 100051, { startParam: `ref_${code}` });

    const referrerFresh = await prisma.user.findUniqueOrThrow({ where: { id: referrer.user.id } });
    const refereeFresh = await prisma.user.findUniqueOrThrow({ where: { id: referee.user.id } });

    expect(referrerFresh.balance).toBe(250 + 150);
    expect(referrerFresh.referralEarned).toBe(150);
    expect(refereeFresh.balance).toBe(250 + 100);
    expect(refereeFresh.referredById).toBe(referrer.user.id);

    const overview = (await app.inject({ method: 'GET', url: '/api/referrals', headers: referrer.auth })).json();
    expect(overview.invited).toBe(1);
    expect(overview.earned).toBe(150);
  });

  it('игнорируют самоприглашение', async () => {
    const { user } = await login(app, 100052);
    const code = (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).referralCode;

    await login(app, 100052, { startParam: `ref_${code}` });

    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fresh.referredById).toBeNull();
    expect(await prisma.referral.count()).toBe(0);
  });

  it('не позволяют сменить реферера повторным входом', async () => {
    const first = await login(app, 100053);
    const second = await login(app, 100054);
    const firstCode = (await prisma.user.findUniqueOrThrow({ where: { id: first.user.id } })).referralCode;
    const secondCode = (await prisma.user.findUniqueOrThrow({ where: { id: second.user.id } })).referralCode;

    const referee = await login(app, 100055, { startParam: `ref_${firstCode}` });
    await login(app, 100055, { startParam: `ref_${secondCode}` });

    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: referee.user.id } });
    expect(fresh.referredById).toBe(first.user.id);
    expect(await prisma.referral.count()).toBe(1);
  });
});
