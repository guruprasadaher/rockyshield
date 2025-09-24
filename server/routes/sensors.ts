import { RequestHandler } from 'express';
import { store } from '../data/store';

export const listSensors: RequestHandler = (req,res) => {
  res.json({ sensors: store.sensors.map(s => ({
    sensor_id: s.sensor_id,
    type: s.type,
    zone_id: s.zone_id,
    status: s.status,
    last_heartbeat: s.last_heartbeat,
    uptime_pct: s.total_ms ? s.active_ms / s.total_ms : 0,
  })) });
};

export const sensorStats: RequestHandler = (req,res) => {
  res.json(store.getSensorStats());
};

export const sensorsCsv: RequestHandler = (req,res) => {
  const lines = [
    'sensor_id,type,zone_id,status,last_heartbeat,uptime_pct'
  ];
  store.sensors.forEach(s => {
    lines.push([s.sensor_id, s.type, s.zone_id, s.status, new Date(s.last_heartbeat).toISOString(), (s.total_ms? (s.active_ms / s.total_ms):0).toFixed(4)].join(','));
  });
  const csv = lines.join('\n');
  res.setHeader('Content-Type','text/csv');
  res.setHeader('Content-Disposition','attachment; filename="sensors.csv"');
  res.send(csv);
};
