import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import {
  formatPayoutTelegramMessage,
  parseTelegramChatIds,
  TelegramService,
} from './telegram.service';

describe('parseTelegramChatIds', () => {
  it('parses a JSON array', () => {
    expect(parseTelegramChatIds('[123, 456]')).toEqual(['123', '456']);
  });

  it('parses a comma-separated list', () => {
    expect(parseTelegramChatIds('123, 456, 789')).toEqual([
      '123',
      '456',
      '789',
    ]);
  });

  it('returns an empty list for blank input', () => {
    expect(parseTelegramChatIds(undefined)).toEqual([]);
    expect(parseTelegramChatIds('  ')).toEqual([]);
  });
});

describe('formatPayoutTelegramMessage', () => {
  it('formats date, copyable id and card number', () => {
    expect(
      formatPayoutTelegramMessage(
        {
          externalId: 'a30288b2-220a-4495-9bcb-6821dcc39331',
          cardNumber: '1234123412341234',
          amount: '100',
        },
        new Date('2026-08-30T16:18:05.000Z'),
      ),
    ).toBe(
      [
        'Дата создания - 2026-08-30 19:18:05',
        'Идентификатор PayStar - <code>a30288b2-220a-4495-9bcb-6821dcc39331</code>',
        'Номер карты - <code>1234123412341234</code>',
        'Сумма платежа - 100',
      ].join('\n'),
    );
  });
});

describe('TelegramService', () => {
  let service: TelegramService;
  let httpService: { post: jest.Mock };

  beforeEach(async () => {
    httpService = {
      post: jest.fn().mockReturnValue(of({ data: { ok: true } })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramService,
        { provide: HttpService, useValue: httpService },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'TELEGRAM_BOT_TOKEN') {
                return 'bot-token';
              }
              if (key === 'TELEGRAM_CHAT_IDS') {
                return '[111,222]';
              }
              return undefined;
            },
          },
        },
      ],
    }).compile();

    service = module.get(TelegramService);
  });

  it('sends the formatted message to every chat id', async () => {
    await service.notifyPayout({
      externalId: 'ext-1',
      cardNumber: '5555',
      amount: '100',
    });

    expect(httpService.post).toHaveBeenCalledTimes(2);
    expect(httpService.post).toHaveBeenCalledWith(
      'https://api.telegram.org/botbot-token/sendMessage',
      expect.objectContaining({
        chat_id: '111',
        parse_mode: 'HTML',
        text: expect.stringContaining(
          'Идентификатор PayStar - <code>ext-1</code>',
        ),
      }),
      expect.any(Object),
    );
    expect(httpService.post.mock.calls[0][1].text).toContain(
      'Номер карты - <code>5555</code>',
    );
    expect(httpService.post.mock.calls[0][1].text).toContain(
      'Сумма платежа - 100',
    );
    expect(httpService.post.mock.calls[0][1].text).toMatch(
      /^Дата создания - \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\n/,
    );
    expect(httpService.post).toHaveBeenCalledWith(
      'https://api.telegram.org/botbot-token/sendMessage',
      expect.objectContaining({
        chat_id: '222',
        parse_mode: 'HTML',
      }),
      expect.any(Object),
    );
  });
});
