import { RequestHandler } from "express";
import { store } from "../data/store";
import { ComplianceEvent } from "@shared/api";

function applyFilters(events: ComplianceEvent[], query: any): ComplianceEvent[] {
  let out = events;
  if (query.zone) out = out.filter(e => e.zone_id === query.zone);
  if (query.worker) out = out.filter(e => e.workers_alerted.includes(query.worker));
  if (query.status) out = out.filter(e => e.status === query.status);
  if (query.severity) out = out.filter(e => e.severity === query.severity);
  if (query.from) out = out.filter(e => e.timestamp >= query.from);
  if (query.to) out = out.filter(e => e.timestamp <= query.to);
  return out;
}

export const listEvents: RequestHandler = (req, res) => {
  const events = applyFilters(store.events, req.query);
  res.json({ events });
};

export const exportCsv: RequestHandler = (req, res) => {
  const events = applyFilters(store.events, req.query);
  const header = ["event_id","timestamp","zone_id","workers_alerted","status","severity","supervisor_action"].join(",");
  const lines = events.map(e => [
    e.event_id,
    e.timestamp,
    e.zone_id,
    '"' + e.workers_alerted.join('|') + '"',
    e.status,
    e.severity,
    '"' + (e.supervisor_action || '') + '"'
  ].join(","));
  const csv = [header, ...lines].join("\n");
  res.setHeader('Content-Type','text/csv');
  res.setHeader('Content-Disposition','attachment; filename="events.csv"');
  res.send(csv);
};
