import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { timingSafeEqual } from "node:crypto";
import { getSupabaseConfig } from "../supabaseConfig.js";

const MAX_PUSH_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [100, 250];
const DELIVERY_CONCURRENCY = 5;

function send(res, status, payload) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(status).json(payload);
}

function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

function isTransientPushError(error) {
  const status = Number(error?.statusCode) || 0;
  return status === 0 || status === 408 || status === 425 || status === 429 || status >= 500;
}

async function sendWithRetry(push, subscription, payload, options, pause) {
  for (let attempt = 0; attempt < MAX_PUSH_ATTEMPTS; attempt += 1) {
    try {
      return await push.sendNotification(subscription, payload, options);
    } catch (error) {
      if (!isTransientPushError(error) || attempt === MAX_PUSH_ATTEMPTS - 1) throw error;
      await pause(RETRY_DELAYS_MS[attempt]);
    }
  }
  throw new Error("Push delivery retry limit reached");
}

async function forEachConcurrent(items, concurrency, handler) {
  let cursor = 0;
  const workerCount = Math.min(items.length, concurrency);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const current = cursor;
      cursor += 1;
      await handler(items[current]);
    }
  }));
}

export function createNotificationDispatcher({
  createClientFn = createClient,
  push = webpush,
  env = process.env,
  logger = console,
  pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  return async function dispatchCashierNotification(req, res) {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return send(res, 405, { error: "Method not allowed" });
    }

    const expectedSecret = String(env.NOTIFY_WEBHOOK_SECRET || "");
    const authorization = String(req.headers.authorization || "");
    const suppliedSecret = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || "";
    if (!expectedSecret || !constantTimeEqual(suppliedSecret, expectedSecret)) {
      return send(res, 401, { error: "Unauthorized" });
    }

    const body = typeof req.body === "string"
      ? (() => { try { return JSON.parse(req.body); } catch { return null; } })()
      : req.body;
    const eventType = body?.event_type;
    const eventId = body?.event_id;
    if (
      !["order", "waiter_call"].includes(eventType) ||
      typeof eventId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId)
    ) {
      return send(res, 400, { error: "Invalid event" });
    }

    const { url, key } = getSupabaseConfig(env);
    const vapidPublicKey = String(env.VAPID_PUBLIC_KEY || "");
    const vapidPrivateKey = String(env.VAPID_PRIVATE_KEY || "");
    const vapidSubject = String(env.VAPID_SUBJECT || "");
    if (!url || !key || !vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      return send(res, 503, { error: "Notification service is not configured" });
    }

    try {
      const supabase = createClientFn(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data: deliveries, error: claimError } = await supabase.rpc(
        "claim_cashier_notification_deliveries",
        { p_secret: expectedSecret, p_event_type: eventType, p_event_id: eventId },
      );
      if (claimError) {
        logger.error("Notification event claim failed", claimError.code || "unknown");
        return send(res, claimError.code === "28000" ? 401 : 502, {
          error: "Unable to validate notification event",
        });
      }

      push.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
      let delivered = 0;
      let failed = 0;
      let expired = 0;
      const jobs = Array.isArray(deliveries) ? deliveries : [];
      await forEachConcurrent(jobs, DELIVERY_CONCURRENCY, async (delivery) => {
        let status = "sent";
        let httpStatus = 201;
        try {
          const result = await sendWithRetry(
            push,
            delivery.push_subscription,
            JSON.stringify({
              title: delivery.notification_title,
              body: delivery.notification_body,
              url: delivery.notification_url,
              tag: `servio-${eventType}-${eventId}`,
            }),
            { TTL: 600, urgency: "high" },
            pause,
          );
          httpStatus = result?.statusCode || 201;
          delivered += 1;
        } catch (pushError) {
          httpStatus = Number(pushError?.statusCode) || 0;
          if (httpStatus === 404 || httpStatus === 410) {
            status = "expired";
            expired += 1;
          } else {
            status = "failed";
            failed += 1;
          }
        }

        try {
          const { error: recordError } = await supabase.rpc("record_cashier_notification_delivery", {
            p_secret: expectedSecret,
            p_event_type: eventType,
            p_event_id: eventId,
            p_subscription_id: delivery.subscription_id,
            p_status: status,
            p_http_status: httpStatus,
          });
          if (recordError) {
            failed += 1;
            logger.error("Notification delivery status update failed", recordError.code || "unknown");
          }
        } catch (recordError) {
          failed += 1;
          logger.error("Notification delivery status update failed", recordError?.code || recordError?.name || "unknown");
        }
      });

      return send(res, 200, { accepted: true, delivered, failed, expired });
    } catch (error) {
      logger.error("Notification dispatch failed", error?.code || error?.name || "unknown");
      return send(res, 500, { error: "Notification dispatch failed" });
    }
  };
}

export default createNotificationDispatcher();
