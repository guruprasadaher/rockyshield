import { RequestHandler } from "express";
import { store } from "../data/store";

export const handlePredict: RequestHandler = (req, res) => {
  const out = store.predict(Date.now());
  res.json(out);
};
