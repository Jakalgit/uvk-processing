import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PayoutModule } from './payout/payout.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PayoutModule,
  ],
})
export class AppModule {}
