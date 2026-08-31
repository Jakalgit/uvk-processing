import { Body, Controller, Headers, Post, Res } from '@nestjs/common';
import { IncomingHttpHeaders } from 'http';
import { Response } from 'express';
import { PayoutService } from './payout.service';

@Controller()
export class PayoutController {
  constructor(private readonly payoutService: PayoutService) {}

  @Post('api/v1/integration/withdrawal-order')
  async createPayout(
    @Body() body: unknown,
    @Headers() headers: IncomingHttpHeaders,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.payoutService.proxyCreate(body, headers);

    if (result.contentType) {
      res.setHeader('Content-Type', result.contentType);
    }

    res.status(result.status).send(result.data);
  }
}
