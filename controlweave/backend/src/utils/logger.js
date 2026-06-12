// @tier: community
let _sentryClient = null;

// Raw console references captured before the bridge (installConsoleBridge)
// rewires the globals — log() must always write through these to avoid
// recursing into the bridge.
const rawConsole = {
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  log: console.log.bind(console)
};

function setSentryClient(sentry) {
  _sentryClient = sentry;
}

function serializeError(err) {
  if (!err) return null;
  return {
    name: err.name,
    message: err.message,
    code: err.code,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  };
}

function log(level, message, meta = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta
  };
  const line = JSON.stringify(payload);

  if (level === 'error') {
    rawConsole.error(line);
    if (_sentryClient) {
      const err = meta instanceof Error ? meta : (meta.error instanceof Error ? meta.error : null);
      if (err) {
        _sentryClient.captureException(err);
      } else {
        _sentryClient.captureMessage(message, 'error');
      }
    }
    return;
  }

  if (level === 'warn') {
    rawConsole.warn(line);
    return;
  }

  rawConsole.log(line);
}

function serializeConsoleArg(arg) {
  if (arg instanceof Error) return serializeError(arg);
  if (typeof arg === 'object' && arg !== null) {
    try {
      return JSON.parse(JSON.stringify(arg));
    } catch (_err) {
      return String(arg);
    }
  }
  return arg;
}

let _bridgeInstalled = false;

// Routes every direct console.error/console.warn call through the structured
// logger so the ~400 legacy call sites in routes/services emit JSON lines
// (and reach Sentry) without per-site rewrites. console.log is left alone —
// scripts and startup banners rely on its plain output.
function installConsoleBridge() {
  if (_bridgeInstalled) return;
  _bridgeInstalled = true;

  const toStructured = (level) => (...args) => {
    const [first, ...rest] = args;
    const message = typeof first === 'string' ? first.replace(/[:\s]+$/, '') : `console.${level}`;
    const meta = {};
    const errArg = args.find((a) => a instanceof Error);
    if (errArg) meta.error = serializeError(errArg);
    const extras = (typeof first === 'string' ? rest : args)
      .filter((a) => !(a instanceof Error))
      .map(serializeConsoleArg);
    if (extras.length) meta.details = extras;
    log(level, message, meta);
  };

  console.error = toStructured('error');
  console.warn = toStructured('warn');
}

// Test hook: restores the original console functions.
function uninstallConsoleBridge() {
  if (!_bridgeInstalled) return;
  _bridgeInstalled = false;
  console.error = rawConsole.error;
  console.warn = rawConsole.warn;
}

function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    log('info', 'request.completed', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      userId: req.user?.id || null,
      organizationId: req.user?.organization_id || null,
      ip: req.ip
    });
  });

  next();
}

module.exports = {
  log,
  serializeError,
  requestLogger,
  setSentryClient,
  installConsoleBridge,
  uninstallConsoleBridge
};
