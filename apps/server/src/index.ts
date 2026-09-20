import http from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleDir, "../..");
const publicDir = path.join(projectRoot, "dist", "public");
const envState = loadEnvironment(projectRoot);

const port = Number(process.env.PORT ?? 3000);
const typeSafeBase = (process.env.TYPESAFE_API_BASE ?? "https://api.typesafe.ai").replace(/\/$/, "");
const openAIBase = (process.env.OPENAI_API_BASE ?? "https://api.openai.com").replace(/\/$/, "");
const typeSafeMaxAttempts = clampInteger(Number(process.env.TYPESAFE_MAX_ATTEMPTS ?? 3), 1, 6);
const typeSafeRetryBaseMs = clampInteger(Number(process.env.TYPESAFE_RETRY_BASE_MS ?? 250), 50, 10_000);

const server = http.createServer(async (req: any, res: any) => {
  const method = String(req.method ?? "GET").toUpperCase();
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  try {
    if (url.pathname === "/api/health" && method === "GET") {
      sendJson(res, 200, {
        ok: true,
        providers: {
          jev: Boolean(process.env.TYPESAFE_API_KEY),
          openai: Boolean(process.env.OPENAI_API_KEY),
        },
        environment: {
          loadedFiles: envState.loadedFiles,
          projectRootDetected: envState.projectRootDetected,
          cwdMatchesProjectRoot: path.resolve(process.cwd()) === path.resolve(projectRoot),
        },
      });
      return;
    }

    if (url.pathname === "/api/jev" && method === "POST") {
      await handleJev(req, res);
      return;
    }

    if (url.pathname === "/api/openai/stream" && method === "POST") {
      await handleOpenAI(req, res);
      return;
    }

    if (method === "GET" || method === "HEAD") {
      serveStatic(url.pathname, method, res);
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    if (!res.headersSent) {
      sendJson(res, 500, {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      });
    } else {
      res.end();
    }
  }
});

server.listen(port, () => {
  const jevReady = Boolean(process.env.TYPESAFE_API_KEY);
  const openAIReady = Boolean(process.env.OPENAI_API_KEY);
  const envSource = envState.loadedFiles.length ? envState.loadedFiles.join(", ") : "system environment only";
  console.log(`Jev x OpenAI Benchmark: http://localhost:${port}`);
  console.log(`Environment: ${envSource}`);
  console.log(`TypeSafe API: ${jevReady ? "ready" : "missing TYPESAFE_API_KEY"}`);
  console.log(`OpenAI API: ${openAIReady ? "ready" : "missing OPENAI_API_KEY"}`);
  if (!jevReady || !openAIReady) console.log(`Expected env file: ${path.join(projectRoot, ".env")}`);
});

async function handleJev(req: any, res: any) {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    sendJson(res, 500, { error: "TYPESAFE_API_KEY is not configured" });
    return;
  }

  const body = await readJsonBody(req);
  const state = body.state;
  const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : "jev-latest";
  const questions = body.questions;

  const validationError = validateTypeSafeRequest(state, questions);
  if (validationError) {
    sendJson(res, 400, { error: validationError });
    return;
  }

  const startedAt = performance.now();
  let retryDelayMs = 0;
  let finalHeadersMs = 0;

  try {
    for (let attempt = 1; attempt <= typeSafeMaxAttempts; attempt += 1) {
      const attemptStartedAt = performance.now();
      const upstream = await fetch(`${typeSafeBase}/v1/systemone`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ state, model, questions }),
        signal: AbortSignal.timeout(120_000),
      });

      const headersAt = performance.now();
      finalHeadersMs = headersAt - startedAt;
      const raw = await upstream.text();
      const completedAt = performance.now();
      const payload = parseJsonOrRaw(raw);
      const retryable = upstream.status === 429 || upstream.status === 529;

      if (!upstream.ok && retryable && attempt < typeSafeMaxAttempts) {
        const delayMs = getRetryDelayMs(upstream.headers.get("retry-after"), attempt);
        retryDelayMs += delayMs;
        await sleep(delayMs);
        continue;
      }

      const totalMs = completedAt - startedAt;
      const attemptMs = completedAt - attemptStartedAt;
      res.setHeader(
        "Server-Timing",
        `typesafe_headers;dur=${finalHeadersMs.toFixed(1)}, typesafe_total;dur=${totalMs.toFixed(1)}`,
      );

      if (!upstream.ok) {
        sendJson(res, upstream.status, {
          error: "TypeSafe API request failed",
          providerStatus: upstream.status,
          details: payload,
          serverMetrics: {
            attempts: attempt,
            retryCount: attempt - 1,
            retryDelayMs,
            finalAttemptMs: attemptMs,
            upstreamHeadersMs: finalHeadersMs,
            upstreamTotalMs: totalMs,
          },
        });
        return;
      }

      sendJson(res, 200, {
        data: payload,
        serverMetrics: {
          attempts: attempt,
          retryCount: attempt - 1,
          retryDelayMs,
          finalAttemptMs: attemptMs,
          upstreamHeadersMs: finalHeadersMs,
          upstreamTotalMs: totalMs,
        },
      });
      return;
    }
  } catch (error) {
    sendJson(res, 502, {
      error: "TypeSafe API request failed",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

async function handleOpenAI(req: any, res: any) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    sendJson(res, 500, { error: "OPENAI_API_KEY is not configured" });
    return;
  }

  const body = await readJsonBody(req);
  const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : "gpt-5.6-luna";
  const input = body.input;
  const reasoningEffort = typeof body.reasoningEffort === "string" ? body.reasoningEffort : "none";
  const maxOutputTokens = Number.isFinite(body.maxOutputTokens) ? Number(body.maxOutputTokens) : 256;
  const responseSchema = isPlainObject(body.responseSchema) ? body.responseSchema : null;
  const schemaName = typeof body.schemaName === "string" && body.schemaName.trim()
    ? body.schemaName.trim().replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64)
    : "benchmark_result";

  if (typeof input !== "string" || !input.trim()) {
    sendJson(res, 400, { error: "input is required" });
    return;
  }

  const controller = new AbortController();
  const startedAt = performance.now();
  let finished = false;

  res.on("close", () => {
    if (!finished) controller.abort();
  });

  try {
    const upstream = await fetch(`${openAIBase}/v1/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        model,
        input,
        stream: true,
        store: false,
        max_output_tokens: maxOutputTokens,
        reasoning: { effort: reasoningEffort },
        ...(responseSchema
          ? {
              text: {
                format: {
                  type: "json_schema",
                  name: schemaName,
                  strict: true,
                  schema: responseSchema,
                },
              },
            }
          : {}),
      }),
      signal: controller.signal,
    });

    const headersAt = performance.now();

    if (!upstream.ok || !upstream.body) {
      const details = await upstream.text();
      sendJson(res, upstream.status || 502, {
        error: "OpenAI API request failed",
        providerStatus: upstream.status,
        details,
      });
      finished = true;
      return;
    }

    res.statusCode = upstream.status;
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Server-Timing", `openai_headers;dur=${(headersAt - startedAt).toFixed(1)}`);
    res.flushHeaders?.();

    const reader = upstream.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.write(Buffer.from(value))) {
        await new Promise<void>((resolve) => res.once("drain", resolve));
      }
    }

    finished = true;
    res.end();
  } catch (error) {
    if (controller.signal.aborted) return;

    if (!res.headersSent) {
      sendJson(res, 502, {
        error: "OpenAI API request failed",
        details: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    res.write(
      `event: error\ndata: ${JSON.stringify({
        type: "proxy.error",
        message: error instanceof Error ? error.message : String(error),
      })}\n\n`,
    );
    res.end();
  }
}

function validateTypeSafeRequest(state: unknown, questions: unknown) {
  if (!isValidState(state)) {
    return "state must be a non-empty string, object, or array";
  }
  if (!isPlainObject(questions) || Object.keys(questions).length === 0) {
    return "questions must be a non-empty object map";
  }

  for (const [questionId, rawQuestion] of Object.entries(questions)) {
    if (!isPlainObject(rawQuestion)) return `questions.${questionId} must be an object`;
    const type = rawQuestion.type;
    const instructions = rawQuestion.instructions;

    if (type !== "noul" && type !== "choice" && type !== "score") {
      return `questions.${questionId}.type must be noul, choice, or score`;
    }
    if (!isInstruction(instructions)) {
      return `questions.${questionId}.instructions must be a string, object, or array`;
    }

    if (type === "noul" && rawQuestion.criteria !== undefined) {
      if (!isPlainObject(rawQuestion.criteria)) {
        return `questions.${questionId}.criteria must be an object for noul`;
      }
      for (const key of Object.keys(rawQuestion.criteria)) {
        if (key !== "true" && key !== "false") {
          return `questions.${questionId}.criteria only supports true and false for noul`;
        }
      }
      if (
        rawQuestion.criteria.true !== undefined && typeof rawQuestion.criteria.true !== "string" ||
        rawQuestion.criteria.false !== undefined && typeof rawQuestion.criteria.false !== "string"
      ) {
        return `questions.${questionId}.criteria true/false values must be strings`;
      }
    }

    if (type === "choice") {
      if (!isPlainObject(rawQuestion.criteria) || Object.keys(rawQuestion.criteria).length < 2) {
        return `questions.${questionId}.criteria must contain at least two choice options`;
      }
      for (const value of Object.values(rawQuestion.criteria)) {
        if (value !== null && typeof value !== "string") {
          return `questions.${questionId}.criteria choice descriptions must be string or null`;
        }
      }
    }

    if (type === "score") {
      if (!Array.isArray(rawQuestion.criteria) || rawQuestion.criteria.length < 2) {
        return `questions.${questionId}.criteria must contain at least two score levels`;
      }
      if (!rawQuestion.criteria.every((value: unknown) => typeof value === "string")) {
        return `questions.${questionId}.criteria score levels must be strings`;
      }
    }
  }

  return null;
}

function isValidState(value: unknown) {
  if (typeof value === "string") return Boolean(value.trim());
  if (Array.isArray(value)) return true;
  return isPlainObject(value);
}

function isInstruction(value: unknown) {
  if (typeof value === "string") return Boolean(value.trim());
  if (Array.isArray(value)) return true;
  return isPlainObject(value);
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRetryDelayMs(retryAfter: string | null, attempt: number) {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, 30_000);
    }

    const dateMs = Date.parse(retryAfter);
    if (Number.isFinite(dateMs)) {
      return Math.max(0, Math.min(dateMs - Date.now(), 30_000));
    }
  }

  const exponential = typeSafeRetryBaseMs * 2 ** Math.max(0, attempt - 1);
  const jitter = Math.random() * typeSafeRetryBaseMs;
  return Math.round(Math.min(exponential + jitter, 30_000));
}

function serveStatic(pathname: string, method: string, res: any) {
  const normalized = pathname === "/" ? "/index.html" : pathname;
  const requested = path.resolve(publicDir, `.${normalized}`);
  const publicRoot = `${path.resolve(publicDir)}${path.sep}`;

  if (!requested.startsWith(publicRoot) || !existsSync(requested) || !statSync(requested).isFile()) {
    const fallback = path.join(publicDir, "index.html");
    if (!existsSync(fallback)) {
      sendJson(res, 404, { error: "Frontend build not found. Run npm run build." });
      return;
    }
    sendFile(fallback, method, res);
    return;
  }

  sendFile(requested, method, res);
}

function sendFile(filePath: string, method: string, res: any) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
  };

  res.statusCode = 200;
  res.setHeader("Content-Type", contentTypes[ext] ?? "application/octet-stream");
  res.setHeader("Cache-Control", ext === ".html" ? "no-cache" : "public, max-age=3600");

  if (method === "HEAD") {
    res.end();
    return;
  }

  createReadStream(filePath).pipe(res);
}

async function readJsonBody(req: any) {
  let body = "";
  let size = 0;

  for await (const chunk of req) {
    const text = String(chunk);
    size += text.length;
    if (size > 2_000_000) throw new Error("Request body is too large");
    body += text;
  }

  if (!body.trim()) return {};
  return JSON.parse(body) as Record<string, any>;
}

function parseJsonOrRaw(raw: string) {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return { raw };
  }
}

function sendJson(res: any, status: number, value: unknown) {
  const body = JSON.stringify(value);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", String(new TextEncoder().encode(body).byteLength));
  res.end(body);
}

function loadEnvironment(rootDir: string) {
  const candidates = [
    process.env.ENV_FILE ? path.resolve(process.env.ENV_FILE) : null,
    path.join(rootDir, ".env.local"),
    path.join(rootDir, ".env"),
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), ".env"),
  ].filter((value): value is string => Boolean(value));

  const loadedFiles: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const normalized = path.resolve(candidate);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    if (loadEnvFile(normalized)) loadedFiles.push(path.basename(normalized));
  }

  return {
    loadedFiles,
    projectRootDetected: existsSync(path.join(rootDir, "package.json")),
  };
}

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return false;

  const lines = String(readFileSync(filePath, "utf8")).split(/\r?\n/);
  for (const line of lines) {
    let trimmed = line.trim().replace(/^\uFEFF/, "");
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("export ")) trimmed = trimmed.slice(7).trim();
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined && value) process.env[key] = value;
  }
  return true;
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
