import { HttpService } from '@nestjs/axios';
import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IncomingHttpHeaders } from 'http';
import { firstValueFrom } from 'rxjs';
import { errorStack, formatErrorDetails } from '../common/log-error';
import { TelegramService } from '../telegram/telegram.service';
import { ExtractedPayoutFields, extractPayoutFields } from './extract-fields';

const DEFAULT_PAYSTAR_PAYOUT_URL =
  'https://secure.PayStar.uk/api/v1/integration/withdrawal-order';

const SKIP_REQUEST_HEADERS = new Set([
  'host',
  'content-length',
  'connection',
  'transfer-encoding',
  'accept-encoding',
]);

export interface ProxiedPayoutResult {
  status: number;
  data: unknown;
  contentType?: string;
  extracted: ExtractedPayoutFields;
}

@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);
  private readonly targetUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly telegramService: TelegramService,
  ) {
    this.targetUrl =
      this.configService.get<string>('PAYSTAR_PAYOUT_URL') ??
      DEFAULT_PAYSTAR_PAYOUT_URL;
  }

  async proxyCreate(
    body: unknown,
    headers: IncomingHttpHeaders,
  ): Promise<ProxiedPayoutResult> {
    let status: number;
    let data: unknown;
    let contentType: string | undefined;

    try {
      const response = await firstValueFrom(
        this.httpService.post(this.targetUrl, body, {
          headers: this.forwardHeaders(headers),
          validateStatus: () => true,
          timeout: 60_000,
        }),
      );
      status = response.status;
      data = response.data;
      const headerValue = response.headers['content-type'];
      if (typeof headerValue === 'string') {
        contentType = headerValue;
      } else if (
        Array.isArray(headerValue) &&
        typeof headerValue[0] === 'string'
      ) {
        contentType = headerValue[0];
      }
    } catch (error) {
      this.logger.error(
        `PayStar proxy failed: ${formatErrorDetails(error)}`,
        errorStack(error),
      );
      throw new BadGatewayException({
        message: 'Failed to reach PayStar payout endpoint',
        target: this.targetUrl,
      });
    }

    const extracted = extractPayoutFields(body, data);

    void this.telegramService.notifyPayout(extracted).catch((error) => {
      this.logger.error(
        `Telegram notify failed: ${formatErrorDetails(error)}`,
        errorStack(error),
      );
    });

    return { status, data, contentType, extracted };
  }

  private forwardHeaders(headers: IncomingHttpHeaders): Record<string, string> {
    const forwarded: Record<string, string> = {};

    for (const [key, value] of Object.entries(headers)) {
      if (value === undefined || SKIP_REQUEST_HEADERS.has(key.toLowerCase())) {
        continue;
      }
      forwarded[key] = Array.isArray(value) ? value.join(',') : value;
    }

    return forwarded;
  }
}
