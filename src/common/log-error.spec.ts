import { formatErrorDetails } from './log-error';
import { AxiosError } from 'axios';

describe('formatErrorDetails', () => {
  it('includes axios status and response without the request body', () => {
    const error = new AxiosError('Request failed');
    error.code = 'ERR_BAD_REQUEST';
    error.config = {
      url: 'https://api.telegram.org/botSECRET_TOKEN/sendMessage',
      data: { text: 'Номер карты - 1234123412341234' },
      headers: {},
    } as AxiosError['config'];
    error.response = {
      status: 400,
      statusText: 'Bad Request',
      data: { ok: false, description: 'Bad Request: chat not found' },
      headers: {},
      config: error.config,
    } as AxiosError['response'];

    const details = formatErrorDetails(error);

    expect(details).toContain('status=400');
    expect(details).toContain('chat not found');
    expect(details).toContain('url=https://api.telegram.org/bot***/sendMessage');
    expect(details).not.toContain('SECRET_TOKEN');
    expect(details).not.toContain('1234123412341234');
  });

  it('redacts card fields from upstream response payloads', () => {
    const error = new AxiosError('Request failed');
    error.response = {
      status: 400,
      statusText: 'Bad Request',
      data: { cardNumber: '1234123412341234', message: 'invalid' },
      headers: {},
      config: {} as AxiosError['config'],
    } as AxiosError['response'];

    const details = formatErrorDetails(error);

    expect(details).toContain('[redacted]');
    expect(details).toContain('invalid');
    expect(details).not.toContain('1234123412341234');
  });
});
