import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TelegramModule } from '../telegram/telegram.module';
import { PayoutController } from './payout.controller';
import { PayoutService } from './payout.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 60_000,
      maxRedirects: 0,
    }),
    TelegramModule,
  ],
  controllers: [PayoutController],
  providers: [PayoutService],
})
export class PayoutModule {}
