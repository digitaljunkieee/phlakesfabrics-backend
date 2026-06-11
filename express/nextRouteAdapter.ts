import type { Express, Request as ExpressRequest, Response as ExpressResponse } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Readable } from 'node:stream';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

type RouteHandler = (
  request: globalThis.Request,
  context: { params: Promise<Record<string, string | string[]>> }
) => Response | Promise<Response>;

type RouteModule = Partial<Record<HttpMethod, RouteHandler>>;

type RouteParam = {
  name: string;
  catchAll: boolean;
};

type ApiRoute = {
  filePath: string;
  regex: RegExp;
  params: RouteParam[];
  dynamicCount: number;
  segmentCount: number;
  catchAll: boolean;
};

type RawBodyRequest = ExpressRequest & {
  rawBody?: Buffer;
  body?: unknown;
};

const API_ROOT = path.resolve(process.cwd(), 'app', 'api');
const MODULE_CACHE = new Map<string, Promise<RouteModule>>();
const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];

function escapeRegex(value: string) {
  return value.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
}

function discoverRouteFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return discoverRouteFiles(fullPath);
    return entry.isFile() && entry.name === 'route.ts' ? [fullPath] : [];
  });
}

function routeFileToApiRoute(filePath: string): ApiRoute | null {
  const relativeParts = path.relative(API_ROOT, filePath).split(path.sep);
  if (relativeParts.at(-1) !== 'route.ts') return null;

  const segments = relativeParts.slice(0, -1);
  const params: RouteParam[] = [];
  let regexSource = '^/api';
  let dynamicCount = 0;
  let catchAll = false;

  for (const segment of segments) {
    const catchAllMatch = /^\[\.\.\.(.+)\]$/.exec(segment);
    if (catchAllMatch) {
      params.push({ name: catchAllMatch[1], catchAll: true });
      regexSource += '/(.+)';
      dynamicCount += 1;
      catchAll = true;
      continue;
    }

    const dynamicMatch = /^\[(.+)\]$/.exec(segment);
    if (dynamicMatch) {
      params.push({ name: dynamicMatch[1], catchAll: false });
      regexSource += '/([^/]+)';
      dynamicCount += 1;
      continue;
    }

    regexSource += `/${escapeRegex(segment)}`;
  }

  regexSource += '/?$';

  return {
    filePath,
    regex: new RegExp(regexSource),
    params,
    dynamicCount,
    segmentCount: segments.length,
    catchAll,
  };
}

export function discoverApiRoutes() {
  return discoverRouteFiles(API_ROOT)
    .map(routeFileToApiRoute)
    .filter((route): route is ApiRoute => Boolean(route))
    .sort((a, b) => {
      if (a.catchAll !== b.catchAll) return a.catchAll ? 1 : -1;
      if (a.dynamicCount !== b.dynamicCount) return a.dynamicCount - b.dynamicCount;
      return b.segmentCount - a.segmentCount;
    });
}

function loadRouteModule(filePath: string) {
  if (!MODULE_CACHE.has(filePath)) {
    MODULE_CACHE.set(filePath, import(pathToFileURL(filePath).href) as Promise<RouteModule>);
  }

  return MODULE_CACHE.get(filePath)!;
}

function extractParams(route: ApiRoute, requestPath: string) {
  const match = route.regex.exec(requestPath);
  const values: Record<string, string | string[]> = {};
  if (!match) return values;

  route.params.forEach((param, index) => {
    const raw = match[index + 1] || '';
    if (param.catchAll) {
      values[param.name] = raw.split('/').filter(Boolean).map((part) => decodeURIComponent(part));
      return;
    }

    values[param.name] = decodeURIComponent(raw);
  });

  return values;
}

function getRequestOrigin(req: ExpressRequest) {
  const protocol = req.protocol || (req.secure ? 'https' : 'http');
  return `${protocol}://${req.get('host') || 'localhost'}`;
}

function appendHeaders(req: ExpressRequest, headers: Headers) {
  Object.entries(req.headers).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(key, item));
      return;
    }

    if (value !== undefined) headers.set(key, String(value));
  });
}

function requestHasBody(req: ExpressRequest) {
  return !['GET', 'HEAD'].includes(req.method.toUpperCase());
}

function buildBufferedBody(req: RawBodyRequest) {
  if (req.rawBody && req.rawBody.length > 0) return req.rawBody;
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return req.body;
  if (req.body && typeof req.body === 'object') return Buffer.from(JSON.stringify(req.body));
  return null;
}

function buildWebRequest(req: RawBodyRequest) {
  const headers = new Headers();
  appendHeaders(req, headers);

  const init: RequestInit & { duplex?: 'half' } = {
    method: req.method,
    headers,
  };

  if (requestHasBody(req)) {
    const bufferedBody = buildBufferedBody(req);
    if (bufferedBody) {
      init.body = Buffer.isBuffer(bufferedBody) ? new Uint8Array(bufferedBody) : bufferedBody;
    } else {
      init.body = Readable.toWeb(req) as ReadableStream;
      init.duplex = 'half';
    }
  }

  return new Request(`${getRequestOrigin(req)}${req.originalUrl}`, init);
}

function applyResponseHeaders(routeResponse: Response, res: ExpressResponse) {
  const headers = routeResponse.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];

  headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') return;
    res.setHeader(key, value);
  });

  if (setCookies.length > 0) {
    res.setHeader('Set-Cookie', setCookies);
    return;
  }

  const singleCookie = headers.get('set-cookie');
  if (singleCookie) res.setHeader('Set-Cookie', singleCookie);
}

async function sendRouteResponse(routeResponse: Response, res: ExpressResponse) {
  applyResponseHeaders(routeResponse, res);
  res.status(routeResponse.status);

  if (routeResponse.status === 204 || routeResponse.status === 304) {
    res.end();
    return;
  }

  const body = Buffer.from(await routeResponse.arrayBuffer());
  res.send(body);
}

async function handleRoute(route: ApiRoute, req: RawBodyRequest, res: ExpressResponse) {
  const routeModule = await loadRouteModule(route.filePath);
  const method = req.method.toUpperCase() as HttpMethod;
  const handler = routeModule[method] || (method === 'HEAD' ? routeModule.GET : undefined);

  if (!handler) {
    const allowed = HTTP_METHODS.filter((candidate) => typeof routeModule[candidate] === 'function');
    res.setHeader('Allow', allowed.join(', '));
    res.status(405).json({
      success: false,
      error: `Method ${method} is not allowed for this API route.`,
      allowed,
    });
    return;
  }

  const routeResponse = await handler(buildWebRequest(req), {
    params: Promise.resolve(extractParams(route, req.path)),
  });

  await sendRouteResponse(routeResponse, res);
}

export function mountNextApiRoutes(app: Express) {
  const routes = discoverApiRoutes();

  routes.forEach((route) => {
    app.all(route.regex, async (req, res, next) => {
      try {
        await handleRoute(route, req as RawBodyRequest, res);
      } catch (error) {
        next(error);
      }
    });
  });

  return routes;
}
