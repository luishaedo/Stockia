import { Request } from 'express';

type CounterKey = string;

type HistogramData = {
    sum: number;
    count: number;
    bucketCounts: number[];
};

const REQUEST_COUNTER = new Map<CounterKey, number>();
const ERROR_COUNTER = new Map<CounterKey, number>();
const LATENCY_HISTOGRAM = new Map<string, HistogramData>();

const LATENCY_BUCKETS_MS = [25, 50, 100, 250, 500, 1000, 2000, 5000];

const normalizePath = (req: Request) => {
    const routePath = req.route?.path;
    if (typeof routePath === 'string') {
        return `${req.baseUrl || ''}${routePath}`;
    }

    return (req.originalUrl || req.path || '/').split('?')[0] || '/';
};

const incrementCounter = (counter: Map<CounterKey, number>, key: CounterKey) => {
    counter.set(key, (counter.get(key) || 0) + 1);
};

const encodeLabels = (labels: Record<string, string | number>) => Object.entries(labels)
    .map(([key, value]) => `${key}="${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
    .join(',');

export const observeHttpRequest = (req: Request, statusCode: number, durationMs: number) => {
    const method = req.method;
    const route = normalizePath(req);

    incrementCounter(REQUEST_COUNTER, `${method}|${route}|${statusCode}`);

    const histogramKey = `${method}|${route}`;
    const histogram = LATENCY_HISTOGRAM.get(histogramKey) ?? {
        sum: 0,
        count: 0,
        bucketCounts: LATENCY_BUCKETS_MS.map(() => 0)
    };

    histogram.count += 1;
    histogram.sum += durationMs;

    LATENCY_BUCKETS_MS.forEach((bucketUpperBound, index) => {
        if (durationMs <= bucketUpperBound) {
            histogram.bucketCounts[index] += 1;
        }
    });

    LATENCY_HISTOGRAM.set(histogramKey, histogram);
};

export const observeHttpError = (req: Request, errorCode: string) => {
    const method = req.method;
    const route = normalizePath(req);
    incrementCounter(ERROR_COUNTER, `${method}|${route}|${errorCode}`);
};

export const getPrometheusMetrics = () => {
    const lines: string[] = [];

    lines.push('# HELP request_count Total HTTP requests by method, route and status code.');
    lines.push('# TYPE request_count counter');
    REQUEST_COUNTER.forEach((value, key) => {
        const [method, route, statusCode] = key.split('|');
        lines.push(`request_count{${encodeLabels({ method, route, status_code: statusCode })}} ${value}`);
    });

    lines.push('# HELP error_count Total handled API errors by method, route and error code.');
    lines.push('# TYPE error_count counter');
    ERROR_COUNTER.forEach((value, key) => {
        const [method, route, errorCode] = key.split('|');
        lines.push(`error_count{${encodeLabels({ method, route, error_code: errorCode })}} ${value}`);
    });

    lines.push('# HELP request_latency_ms HTTP request latency histogram in milliseconds by method and route.');
    lines.push('# TYPE request_latency_ms histogram');
    LATENCY_HISTOGRAM.forEach((value, key) => {
        const [method, route] = key.split('|');
        value.bucketCounts.forEach((bucketCount, index) => {
            lines.push(`request_latency_ms_bucket{${encodeLabels({ method, route, le: LATENCY_BUCKETS_MS[index] })}} ${bucketCount}`);
        });
        lines.push(`request_latency_ms_bucket{${encodeLabels({ method, route, le: '+Inf' })}} ${value.count}`);
        lines.push(`request_latency_ms_sum{${encodeLabels({ method, route })}} ${value.sum}`);
        lines.push(`request_latency_ms_count{${encodeLabels({ method, route })}} ${value.count}`);
    });

    return `${lines.join('\n')}\n`;
};
