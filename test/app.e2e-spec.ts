import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as request from 'supertest';
import { of } from 'rxjs';
import { AppModule } from './../src/app.module';

describe('Payout proxy (e2e)', () => {
  let app: INestApplication;
  const httpService = { post: jest.fn() };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HttpService)
      .useValue(httpService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /api/v1/integration/withdrawal-order proxies status and body', () => {
    httpService.post.mockReturnValue(
      of({
        status: 200,
        data: {
          externalId: 'a30288b2-220a-4495-9bcb-6821dcc39331',
          orderStatus: 'Created',
        },
        headers: { 'content-type': 'application/json' },
      }),
    );

    return request(app.getHttpServer())
      .post('/api/v1/integration/withdrawal-order')
      .set('Authorization', 'Bearer test-token')
      .send({
        amount: 100,
        currency: 'USD',
        externalTransactionId: 'Merch12345',
        additionalFields: [{ key: 'CardNumber', value: '1234123412341234' }],
      })
      .expect(200)
      .expect({
        externalId: 'a30288b2-220a-4495-9bcb-6821dcc39331',
        orderStatus: 'Created',
      });
  });
});
