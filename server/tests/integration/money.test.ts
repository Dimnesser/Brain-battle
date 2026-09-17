import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/db.js';
import { createApp, login, resetDatabase, setBalance } from '../helpers.js';

let app: FastifyInstance;

const PAYMENT_SECRET = 'test_payment_secret';
const ADMIN_TELEGRAM_ID = 900_000_001;

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

/** Создаёт платёж и возвращает его providerRef для имитации webhook-а. */
async function createDeposit(auth: Record<string, string>, amount: number) {
  const response = await app.inject({ method: 'POST', url: '/api/deposit', headers: auth, payload: { amount } });
  expect(response.statusCode).toBe(200);

  const deposit = response.json().deposit;
  const record = await prisma.deposit.findUniqueOrThrow({ where: { id: deposit.id } });
  return { deposit, providerRef: record.providerRef! };
}

function webhook(providerRef: string, status = 'PAID', secret = PAYMENT_SECRET) {
  return app.inject({
    method: 'POST',
    url: '/api/payments/webhook/mock',
    headers: { 'x-payment-secret': secret },
    payload: { providerRef, status },
  });
}

describe('пополнение', () => {
  it('зачисляет средства только после подтверждения платежа', async () => {
    const { user, auth } = await login(app, 200001);
    const { providerRef } = await createDeposit(auth, 1000);

    // До webhook-а баланс не меняется
    let fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fresh.balance).toBe(250);

    const confirmed = await webhook(providerRef);
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json().credited).toBe(true);

    fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const deposit = await prisma.deposit.findFirstOrThrow({ where: { userId: user.id } });
    expect(deposit.status).toBe('PAID');
    expect(fresh.balance).toBe(250 + deposit.amount + deposit.bonusAmount);
    expect(fresh.totalDeposited).toBe(deposit.amount);
  });

  it('не зачисляет средства дважды по повторному webhook-у', async () => {
    const { user, auth } = await login(app, 200002);
    const { providerRef } = await createDeposit(auth, 500);

    await webhook(providerRef);
    const balanceAfterFirst = (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).balance;

    const repeat = await webhook(providerRef);
    expect(repeat.statusCode).toBe(200);
    expect(repeat.json().credited).toBe(false);

    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fresh.balance).toBe(balanceAfterFirst);
  });

  it('не зачисляет средства при параллельных webhook-ах', async () => {
    const { user, auth } = await login(app, 200003);
    const { providerRef } = await createDeposit(auth, 500);

    const responses = await Promise.all(Array.from({ length: 5 }, () => webhook(providerRef)));
    const credited = responses.filter((r) => r.json().credited === true);

    expect(credited).toHaveLength(1);
    const deposits = await prisma.transaction.count({ where: { userId: user.id, type: 'DEPOSIT' } });
    expect(deposits).toBe(1);
  });

  it('отклоняет webhook без корректной подписи', async () => {
    const { user, auth } = await login(app, 200004);
    const { providerRef } = await createDeposit(auth, 500);

    const wrong = await webhook(providerRef, 'PAID', 'неверный_секрет');
    expect(wrong.statusCode).toBe(403);

    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fresh.balance).toBe(250);
  });

  it('начисляет бонус к пополнению по проценту дня', async () => {
    const { auth } = await login(app, 200005);
    const overview = (await app.inject({ method: 'GET', url: '/api/deposit', headers: auth })).json();
    const { deposit } = await createDeposit(auth, 1000);

    expect(deposit.bonusPercent).toBe(overview.bonusPercent);
    expect(deposit.bonusAmount).toBe(Math.floor((deposit.amount * overview.bonusPercent) / 100));
  });

  it('отклоняет слишком маленькую и слишком большую сумму', async () => {
    const { auth } = await login(app, 200006);

    const small = await app.inject({ method: 'POST', url: '/api/deposit', headers: auth, payload: { amount: 1 } });
    const huge = await app.inject({
      method: 'POST',
      url: '/api/deposit',
      headers: auth,
      payload: { amount: 10_000_000 },
    });

    expect(small.statusCode).toBe(422);
    expect(huge.statusCode).toBe(422);
  });

  it('начисляет рефереру процент с пополнения приглашённого', async () => {
    const referrer = await login(app, 200007);
    const code = (await prisma.user.findUniqueOrThrow({ where: { id: referrer.user.id } })).referralCode;
    const referee = await login(app, 200008, { startParam: `ref_${code}` });

    const balanceBefore = (await prisma.user.findUniqueOrThrow({ where: { id: referrer.user.id } })).balance;
    const { providerRef } = await createDeposit(referee.auth, 1000);
    await webhook(providerRef);

    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: referrer.user.id } });
    expect(fresh.balance).toBe(balanceBefore + 100); // 10% от 1000
  });
});

describe('вывод средств', () => {
  it('резервирует сумму сразу при создании заявки', async () => {
    const { user, auth } = await login(app, 200020);
    await setBalance(user.id, 5000);

    const response = await app.inject({
      method: 'POST',
      url: '/api/withdrawal',
      headers: auth,
      payload: { amount: 2000, method: 'card', requisites: '2200000000001234' },
    });

    expect(response.statusCode).toBe(200);
    const withdrawal = response.json().withdrawal;
    expect(withdrawal.status).toBe('PENDING');
    expect(withdrawal.fee).toBe(100); // 5%
    expect(withdrawal.payout).toBe(1900);

    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fresh.balance).toBe(3000);
  });

  it('не раскрывает полные реквизиты игроку', async () => {
    const { user, auth } = await login(app, 200021);
    await setBalance(user.id, 5000);

    const created = await app.inject({
      method: 'POST',
      url: '/api/withdrawal',
      headers: auth,
      payload: { amount: 2000, method: 'card', requisites: '2200000000001234' },
    });

    expect(created.json().withdrawal.requisites).not.toContain('220000000000');
    expect(created.json().withdrawal.requisites).toBe('22••••1234');
  });

  it('отклоняет сумму ниже минимума и превышающую баланс', async () => {
    const { user, auth } = await login(app, 200022);
    await setBalance(user.id, 1500);

    const tooSmall = await app.inject({
      method: 'POST',
      url: '/api/withdrawal',
      headers: auth,
      payload: { amount: 100, method: 'card', requisites: '2200000000001234' },
    });
    const tooBig = await app.inject({
      method: 'POST',
      url: '/api/withdrawal',
      headers: auth,
      payload: { amount: 5000, method: 'card', requisites: '2200000000001234' },
    });

    expect(tooSmall.statusCode).toBe(422);
    expect(tooBig.statusCode).toBe(400);

    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fresh.balance).toBe(1500);
  });

  it('возвращает средства при отклонении заявки', async () => {
    const player = await login(app, 200023);
    const admin = await login(app, ADMIN_TELEGRAM_ID);
    await setBalance(player.user.id, 5000);

    const created = await app.inject({
      method: 'POST',
      url: '/api/withdrawal',
      headers: player.auth,
      payload: { amount: 2000, method: 'card', requisites: '2200000000001234' },
    });
    const withdrawalId = created.json().withdrawal.id;

    const rejected = await app.inject({
      method: 'POST',
      url: `/api/admin/withdrawals/${withdrawalId}/reject`,
      headers: admin.auth,
      payload: { comment: 'неверные реквизиты' },
    });

    expect(rejected.statusCode).toBe(200);
    expect(rejected.json().withdrawal.status).toBe('REJECTED');

    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: player.user.id } });
    expect(fresh.balance).toBe(5000);
  });

  it('при одобрении средства не возвращаются', async () => {
    const player = await login(app, 200024);
    const admin = await login(app, ADMIN_TELEGRAM_ID);
    await setBalance(player.user.id, 5000);

    const created = await app.inject({
      method: 'POST',
      url: '/api/withdrawal',
      headers: player.auth,
      payload: { amount: 2000, method: 'sbp', requisites: '+79000000000' },
    });
    const withdrawalId = created.json().withdrawal.id;

    const approved = await app.inject({
      method: 'POST',
      url: `/api/admin/withdrawals/${withdrawalId}/approve`,
      headers: admin.auth,
      payload: {},
    });

    expect(approved.statusCode).toBe(200);
    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: player.user.id } });
    expect(fresh.balance).toBe(3000);
  });

  it('не обрабатывает одну заявку дважды', async () => {
    const player = await login(app, 200025);
    const admin = await login(app, ADMIN_TELEGRAM_ID);
    await setBalance(player.user.id, 5000);

    const created = await app.inject({
      method: 'POST',
      url: '/api/withdrawal',
      headers: player.auth,
      payload: { amount: 2000, method: 'card', requisites: '2200000000001234' },
    });
    const withdrawalId = created.json().withdrawal.id;

    const first = await app.inject({
      method: 'POST',
      url: `/api/admin/withdrawals/${withdrawalId}/reject`,
      headers: admin.auth,
      payload: {},
    });
    const second = await app.inject({
      method: 'POST',
      url: `/api/admin/withdrawals/${withdrawalId}/reject`,
      headers: admin.auth,
      payload: {},
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(422);

    // Повторный отказ не должен начислить возврат второй раз
    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: player.user.id } });
    expect(fresh.balance).toBe(5000);
  });
});

describe('права администратора', () => {
  it('не пускают обычного игрока в админ-API', async () => {
    const { auth } = await login(app, 200030);

    for (const url of ['/api/admin/stats', '/api/admin/users', '/api/admin/cases', '/api/admin/withdrawals']) {
      const response = await app.inject({ method: 'GET', url, headers: auth });
      expect(response.statusCode).toBe(403);
    }
  });

  it('выдают админом только игрока из ADMIN_TELEGRAM_ID', async () => {
    const admin = await login(app, ADMIN_TELEGRAM_ID);
    expect(admin.user).toMatchObject({ isAdmin: true });

    const response = await app.inject({ method: 'GET', url: '/api/admin/stats', headers: admin.auth });
    expect(response.statusCode).toBe(200);
  });

  it('учитывают отзыв прав немедленно, не дожидаясь нового токена', async () => {
    const admin = await login(app, ADMIN_TELEGRAM_ID);
    await prisma.user.update({ where: { id: admin.user.id }, data: { isAdmin: false } });

    // Токен ещё содержит adm=true, но права перечитываются из базы
    const response = await app.inject({ method: 'GET', url: '/api/admin/stats', headers: admin.auth });
    expect(response.statusCode).toBe(403);
  });

  it('фиксируют изменение баланса в истории и аудите', async () => {
    const player = await login(app, 200031);
    const admin = await login(app, ADMIN_TELEGRAM_ID);

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${player.user.id}/balance`,
      headers: admin.auth,
      payload: { amount: 700, reason: 'компенсация' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().balance).toBe(950);

    const transaction = await prisma.transaction.findFirstOrThrow({
      where: { userId: player.user.id, type: 'ADMIN_ADJUST' },
    });
    expect(transaction.amount).toBe(700);

    const action = await prisma.adminAction.findFirstOrThrow({ where: { action: 'user.balance' } });
    expect(action.targetId).toBe(player.user.id);
  });

  it('не дают списать больше, чем есть на балансе', async () => {
    const player = await login(app, 200032);
    const admin = await login(app, ADMIN_TELEGRAM_ID);

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${player.user.id}/balance`,
      headers: admin.auth,
      payload: { amount: -10_000, reason: 'ошибка' },
    });

    expect(response.statusCode).toBe(400);
    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: player.user.id } });
    expect(fresh.balance).toBe(250);
  });

  it('блокировка закрывает игроку доступ к игре', async () => {
    const player = await login(app, 200033);
    const admin = await login(app, ADMIN_TELEGRAM_ID);

    await app.inject({
      method: 'POST',
      url: `/api/admin/users/${player.user.id}/ban`,
      headers: admin.auth,
      payload: { isBanned: true, reason: 'мультиаккаунт' },
    });

    const response = await app.inject({ method: 'GET', url: '/api/cases', headers: player.auth });
    expect(response.statusCode).toBe(403);
  });
});
