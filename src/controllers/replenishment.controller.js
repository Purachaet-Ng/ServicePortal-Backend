import * as service from "../services/replenishment.service.js";
export async function getCentralStocks(req, res, next) {
  try { res.json({ data: await service.centralStocks(req.user) }); } catch (error) { next(error); }
}
export async function postCentralStock(req, res, next) {
  try { res.status(201).json({ data: await service.receiveCentralStock(req.valid.body, req.user) }); } catch (error) { next(error); }
}
export async function getReplenishments(req, res, next) {
  try { res.json({ data: await service.listReplenishments(req.user) }); } catch (error) { next(error); }
}
export async function postReplenishment(req, res, next) {
  try { res.status(201).json({ data: await service.requestReplenishment(req.valid.body, req.user) }); } catch (error) { next(error); }
}
export async function patchReplenishment(req, res, next) {
  try { res.json({ data: await service.updateReplenishment(req.valid.params.id, req.valid.body, req.user) }); } catch (error) { next(error); }
}
