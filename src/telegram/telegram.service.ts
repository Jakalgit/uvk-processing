import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { errorStack, formatErrorDetails } from '../common/log-error';
import { ExtractedPayoutFields } from '../payout/extract-fields';

export function parseTelegramChatIds(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }

  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.map((id) => String(id).trim()).filter(Boolean);
    } catch {
      return [];
    }
  }

  return trimmed
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

export function formatCreatedAt(
  date: Date,
  timeZone = 'Europe/Moscow',
): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

export function formatPayoutTelegramMessage(
  fields: ExtractedPayoutFields,
  createdAt: Date = new Date(),
): string {
  return [
    `Дата создания - ${formatCreatedAt(createdAt)}`,
    `Идентификатор PayStar - ${copyable(fields.externalId)}`,
    `Номер карты - ${copyable(fields.cardNumber)}`,
    `Сумма платежа - ${fields.amount ?? '—'}`,
  ].join('\n');
}

function copyable(value: string | undefined): string {
  if (!value) {
    return '—';
  }
  return `<code>${escapeHtml(value)}</code>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async notifyPayout(fields: ExtractedPayoutFields): Promise<void> {
    if (!fields.externalId && !fields.cardNumber) {
      return;
    }

    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    const chatIds = parseTelegramChatIds(
      this.configService.get<string>('TELEGRAM_CHAT_IDS'),
    );

    if (!token || chatIds.length === 0) {
      const missing = [
        !token ? 'TELEGRAM_BOT_TOKEN' : null,
        chatIds.length === 0 ? 'TELEGRAM_CHAT_IDS' : null,
      ].filter(Boolean);
      this.logger.error(
        `Telegram notify failed: missing ${missing.join(', ')}`,
      );
      return;
    }

    const text = formatPayoutTelegramMessage(fields);
    const results = await Promise.allSettled(
      chatIds.map((chatId) => this.sendMessage(token, chatId, text)),
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.error(
          `Telegram sendMessage failed for chat ${chatIds[index]}: ${formatErrorDetails(result.reason)}`,
          errorStack(result.reason),
        );
      }
    });
  }

  private async sendMessage(
    token: string,
    chatId: string,
    text: string,
  ): Promise<void> {
    await firstValueFrom(
      this.httpService.post(
        `https://api.telegram.org/bot${token}/sendMessage`,
        { chat_id: chatId, text, parse_mode: 'HTML' },
        { timeout: 15_000 },
      ),
    );
  }
}
