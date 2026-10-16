import { extractPayoutFields } from './extract-fields';

describe('extractPayoutFields', () => {
  it('takes CardNumber from additionalFields and externalId from the response', () => {
    const requestBody = {
      amount: 100,
      additionalFields: [
        { key: 'CardNumber', value: '1234123412341234' },
        { key: 'bankName', value: 'SuperBank' },
      ],
    };
    const responseBody = {
      externalId: 'a30288b2-220a-4495-9bcb-6821dcc39331',
      orderStatus: 'Created',
    };

    expect(extractPayoutFields(requestBody, responseBody)).toEqual({
      externalId: 'a30288b2-220a-4495-9bcb-6821dcc39331',
      cardNumber: '1234123412341234',
      amount: '100',
    });
  });

  it('matches cardNumber key case-insensitively', () => {
    const requestBody = {
      additionalFields: [{ key: 'cardNumber', value: '5555444433332222' }],
    };

    expect(extractPayoutFields(requestBody, {})).toEqual({
      externalId: undefined,
      cardNumber: '5555444433332222',
      amount: undefined,
    });
  });

  it('falls back to externalId on the request when the response has none', () => {
    expect(
      extractPayoutFields({ externalId: 'req-id' }, { orderStatus: 'Created' }),
    ).toEqual({
      externalId: 'req-id',
      cardNumber: undefined,
      amount: undefined,
    });
  });
});
