import { RequestHandler } from "express";
import { store } from "../data/store";
import type { AlertItem } from "@shared/api";

let twilioClient: any | null = null;
function getTwilio() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  if (!twilioClient) twilioClient = require("twilio")(sid, token);
  return twilioClient;
}

export const listAlerts: RequestHandler = (req, res) => {
  res.json({ alerts: store.alerts });
};

export const sendAlert: RequestHandler = async (req, res) => {
  const body = req.body as { alert: AlertItem; toPhone?: string };
  if (!body?.alert) return res.status(400).json({ error: "alert required" });
  store.alerts.unshift(body.alert);

  const client = getTwilio();
  if (client && (body.toPhone || process.env.ALERT_TO_PHONE) && process.env.TWILIO_FROM_NUMBER) {
    try {
      await client.messages.create({
        body: `${body.alert.message}. Actions: ${body.alert.actions.join("; ")}`,
        from: process.env.TWILIO_FROM_NUMBER,
        to: body.toPhone || process.env.ALERT_TO_PHONE,
      });
    } catch (e) {
      console.error("Twilio send failed", e);
    }
  } else {
    console.log("ALERT", body.alert);
  }

  res.json({ ok: true });
};
