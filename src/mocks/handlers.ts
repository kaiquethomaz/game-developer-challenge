import { delay, http, HttpResponse, type RequestHandler } from 'msw';
import {
  API_ROUTES,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parseMatchSubmission,
  type ApiErrorBody,
} from '../api/contracts';
import { queryHistory, queryRanking, saveMatch } from './matchStore';
import { mockBackend } from './mockBackend';

type Endpoint = 'ranking' | 'history' | 'record';

const SLOW_LATENCY_MS = 2500;
const OUT_OF_ORDER_SLOW_MS = 1800;
const OUT_OF_ORDER_FAST_MS = 150;
const RECORD_TIMEOUT_DELAY_MS = 10_000;

export const handlers: RequestHandler[] = [
  http.get(API_ROUTES.ranking, async ({ request }) => {
    const failure = await simulateNetwork('ranking');
    if (failure) return failure;

    const url = new URL(request.url);
    const duration = Number(url.searchParams.get('matchDurationSeconds'));
    const interval = Number(url.searchParams.get('spawnIntervalSeconds'));
    if (
      !Number.isFinite(duration) ||
      !Number.isFinite(interval) ||
      duration <= 0 ||
      interval <= 0
    ) {
      return errorResponse(400, 'invalid_query', 'A valid match configuration is required.');
    }

    return HttpResponse.json(
      queryRanking(
        mockBackend.allRecords(),
        { matchDurationSeconds: duration, spawnIntervalSeconds: interval },
        readPage(url),
        readPageSize(url),
      ),
    );
  }),

  http.get('/api/players/:playerId/matches', async ({ request, params }) => {
    const failure = await simulateNetwork('history');
    if (failure) return failure;

    const url = new URL(request.url);
    const playerId = String(params.playerId);
    return HttpResponse.json(
      queryHistory(mockBackend.allRecords(), playerId, readPage(url), readPageSize(url)),
    );
  }),

  http.put('/api/matches/:matchId', async ({ request, params }) => {
    const failure = await simulateNetwork('record');
    if (failure) return failure;

    const body: unknown = await request.json().catch(() => null);
    const submission = parseMatchSubmission(body);
    if (!submission || submission.matchId !== params.matchId) {
      return errorResponse(422, 'invalid_match', 'The match payload is invalid.');
    }

    const records = mockBackend.storedRecords();
    const result = saveMatch(records, submission, new Date().toISOString());
    if (result.status === 'conflict') {
      return errorResponse(409, 'match_conflict', 'A different match already uses this id.');
    }
    if (result.status === 'created') mockBackend.persist(records);

    if (mockBackend.shouldTimeOutAfterSave(submission.matchId)) {
      await delay(RECORD_TIMEOUT_DELAY_MS);
    }
    return HttpResponse.json(result.record, { status: result.status === 'created' ? 201 : 200 });
  }),
];

async function simulateNetwork(endpoint: Endpoint): Promise<Response | null> {
  const { scenario, latencyMs } = mockBackend.getSettings();
  const requestIndex = mockBackend.nextRequestIndex();

  switch (scenario) {
    case 'slow':
      await delay(SLOW_LATENCY_MS);
      break;
    case 'variable-latency':
      await delay(Math.round(mockBackend.randomBetween(100, 2000)));
      break;
    case 'out-of-order':
      await delay(requestIndex % 2 === 1 ? OUT_OF_ORDER_SLOW_MS : OUT_OF_ORDER_FAST_MS);
      break;
    case 'timeout':
      await delay('infinite');
      break;
    default:
      if (latencyMs > 0) await delay(latencyMs);
  }

  switch (scenario) {
    case 'network-error':
      return HttpResponse.error();
    case 'server-error':
      return errorResponse(500, 'internal_error', 'The server failed to process the request.');
    case 'client-error':
      return errorResponse(400, 'bad_request', 'The request was rejected.');
    case 'ranking-error':
      return endpoint === 'ranking' ? unavailable() : null;
    case 'history-error':
      return endpoint === 'history' ? unavailable() : null;
    case 'record-unavailable':
      return endpoint === 'record' ? unavailable() : null;
    default:
      return null;
  }
}

function unavailable(): Response {
  return errorResponse(503, 'service_unavailable', 'The service is temporarily unavailable.');
}

function errorResponse(status: number, error: string, message: string): Response {
  return HttpResponse.json<ApiErrorBody>({ error, message }, { status });
}

function readPage(url: URL): number {
  const page = Number(url.searchParams.get('page') ?? 1);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function readPageSize(url: URL): number {
  const size = Number(url.searchParams.get('pageSize') ?? DEFAULT_PAGE_SIZE);
  return Number.isInteger(size) && size > 0 ? Math.min(size, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
}
