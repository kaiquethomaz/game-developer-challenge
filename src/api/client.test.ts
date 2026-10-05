import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it } from 'vitest';
import { ApiError, toApiError } from './client';
import { shouldRetry } from './queries';

const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;

function httpError(status: number): AxiosError {
  return new AxiosError('failed', 'ERR_BAD_RESPONSE', config, null, {
    status,
    statusText: 'error',
    data: { error: 'x', message: 'Server says no.' },
    headers: {},
    config,
  });
}

describe('toApiError', () => {
  it('classifies timeouts, network failures and http errors', () => {
    expect(toApiError(new AxiosError('timeout', AxiosError.ECONNABORTED)).kind).toBe('timeout');
    expect(toApiError(new AxiosError('down', AxiosError.ERR_NETWORK)).kind).toBe('network');
    const error = toApiError(httpError(503));
    expect(error).toMatchObject({ kind: 'http', status: 503, message: 'Server says no.' });
  });
});

describe('retry policy', () => {
  it('retries transient failures a limited number of times', () => {
    expect(shouldRetry(0, new ApiError('timeout', 't'))).toBe(true);
    expect(shouldRetry(0, toApiError(httpError(500)))).toBe(true);
    expect(shouldRetry(2, new ApiError('network', 'n'))).toBe(false);
  });

  it('does not retry client errors', () => {
    expect(shouldRetry(0, toApiError(httpError(400)))).toBe(false);
    expect(shouldRetry(0, toApiError(httpError(409)))).toBe(false);
  });
});
