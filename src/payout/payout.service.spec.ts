import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { TelegramService } from '../telegram/telegram.service';
import { PayoutService } from './payout.service';

describe('PayoutService', () => {
  let service: PayoutService;
  let httpService: { post: jest.Mock };
  let telegramService: { notifyPayout: jest.Mock };

  beforeEach(async () => {
    httpService = { post: jest.fn() };
    telegramService = { notifyPayout: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutService,
        { provide: HttpService, useValue: httpService },
        { provide: TelegramService, useValue: telegramService },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'PAYSTAR_PAYOUT_URL'
                ? 'https://secure.PayStar.uk/api/v1/integration/withdrawal-order/'
                : undefined,
          },
        },
      ],
    }).compile();

    service = module.get(PayoutService);
  });

  it('forwards the body and Authorization header, then extracts fields', async () => {
    const body = {
      amount: 100,
      currency: 'USD',
      externalTransactionId: 'Merch12345',
      additionalFields: [{ key: 'cardNumber', value: '1234123412341234' }],
    };
    const upstream = {
      externalId: 'a30288b2-220a-4495-9bcb-6821dcc39331',
      orderStatus: 'Created',
    };

    httpService.post.mockReturnValue(
      of({
        status: 200,
        data: upstream,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await service.proxyCreate(body, {
      authorization: 'Bearer test-token',
      host: 'localhost:3000',
    });

    expect(httpService.post).toHaveBeenCalledWith(
      'https://secure.PayStar.uk/api/v1/integration/withdrawal-order/',
      body,
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer test-token',
        }),
      }),
    );
    expect(httpService.post.mock.calls[0][2].headers.host).toBeUndefined();
    expect(result.status).toBe(200);
    expect(result.data).toEqual(upstream);
    expect(result.extracted).toEqual({
      externalId: 'a30288b2-220a-4495-9bcb-6821dcc39331',
      cardNumber: '1234123412341234',
      amount: '100',
    });
    expect(telegramService.notifyPayout).toHaveBeenCalledWith({
      externalId: 'a30288b2-220a-4495-9bcb-6821dcc39331',
      cardNumber: '1234123412341234',
      amount: '100',
    });
  });

  it('proxies non-2xx PayStar responses as-is', async () => {
    httpService.post.mockReturnValue(
      of({
        status: 401,
        data: { message: 'Unauthorized' },
        headers: {},
      }),
    );

    const result = await service.proxyCreate({}, {});
    expect(result.status).toBe(401);
    expect(result.data).toEqual({ message: 'Unauthorized' });
  });

  it('returns the PayStar response without waiting for Telegram', async () => {
    httpService.post.mockReturnValue(
      of({
        status: 200,
        data: { externalId: 'id-1', orderStatus: 'Created' },
        headers: {},
      }),
    );

    let resolveTelegram: () => void;
    telegramService.notifyPayout.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveTelegram = resolve;
      }),
    );

    const result = await service.proxyCreate({}, {});

    expect(result.status).toBe(200);
    expect(result.data).toEqual({ externalId: 'id-1', orderStatus: 'Created' });
    expect(telegramService.notifyPayout).toHaveBeenCalled();

    resolveTelegram!();
  });

  it('still returns the PayStar response if Telegram notify fails', async () => {
    httpService.post.mockReturnValue(
      of({
        status: 200,
        data: { externalId: 'id-1', orderStatus: 'Created' },
        headers: {},
      }),
    );
    telegramService.notifyPayout.mockRejectedValue(new Error('telegram down'));

    const result = await service.proxyCreate({}, {});
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ externalId: 'id-1', orderStatus: 'Created' });

    await Promise.resolve();
  });

  it('returns 502 when PayStar is unreachable', async () => {
    httpService.post.mockReturnValue(throwError(() => new Error('timeout')));

    await expect(service.proxyCreate({}, {})).rejects.toMatchObject({
      status: 502,
    });
  });
});
