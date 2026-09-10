import * as inventoryService from "../services/inventory.service.js";

export async function getItems(req, res, next) {
  try {
    const data = await inventoryService.listCatalog();
    return res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function postItem(req, res, next) {
  try {
    const data = await inventoryService.createCatalogItem(req.valid.body);
    return res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function patchItem(req, res, next) {
  try {
    const data = await inventoryService.updateCatalogItem(
      req.valid.params.id,
      req.valid.body,
    );
    return res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function deleteItem(req, res, next) {
  try {
    const data = await inventoryService.deleteCatalogItem(req.valid.params.id);
    return res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function getStocks(req, res, next) {
  try {
    const data = await inventoryService.listStocks(req.user);
    return res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function postStock(req, res, next) {
  try {
    const data = await inventoryService.createDepartmentStock(req.valid.body);
    return res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function patchStock(req, res, next) {
  try {
    const data = await inventoryService.updateDepartmentStock(
      req.valid.params.id,
      req.valid.body,
    );
    return res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function postAdjustment(req, res, next) {
  try {
    const data = await inventoryService.adjustDepartmentStock(
      req.valid.params.id,
      req.valid.body,
      req.user,
    );
    return res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
}


export async function postAsset(req, res, next) {
  try {
    const data = await inventoryService.createAsset(req.valid.body, req.user);
    return res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function patchAsset(req, res, next) {
  try {
    const data = await inventoryService.updateAsset(
      req.valid.params.id,
      req.valid.body,
      req.user,
    );
    return res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function getRequests(req, res, next) {
  try {
    const data = await inventoryService.listRequests(req.user);
    return res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function postRequest(req, res, next) {
  try {
    const data = await inventoryService.createInventoryRequest(
      req.valid.body,
      req.user,
    );
    return res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function patchRequestStatus(req, res, next) {
  try {
    const data = await inventoryService.changeRequestStatus(
      req.valid.params.id,
      req.valid.body,
      req.user,
    );
    return res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function getMovements(req, res, next) {
  try {
    const data = await inventoryService.listMovements(req.user);
    return res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function getAssignments(req, res, next) {
  try {
    const data = await inventoryService.listAssignments(req.user);
    return res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function postAssignment(req, res, next) {
  try {
    const data = await inventoryService.issueAssetDirectly(
      req.valid.body,
      req.user,
    );
    return res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function postAssignmentReturn(req, res, next) {
  try {
    const data = await inventoryService.returnAssignment(
      req.valid.params.id,
      req.valid.body,
      req.user,
    );
    return res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}
