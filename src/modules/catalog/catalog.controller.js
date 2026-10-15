import * as catalogService from './catalog.service';
import * as serviceCatalogService from './serviceCatalog.service';

// ================= CATEGORY CONTROLLER =================

export const listCategories = async (req, res, next) => {
  try {
    const result = await catalogService.listCategories(req.query, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const result = await catalogService.createCategory(req.body, req.actor);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const getCategoryById = async (req, res, next) => {
  try {
    const result = await catalogService.getCategoryById(req.params.id, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const result = await catalogService.updateCategory(req.params.id, req.body, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const archiveCategory = async (req, res, next) => {
  try {
    const result = await catalogService.archiveCategory(req.params.id, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// ================= PRODUCT CONTROLLER =================

export const listProducts = async (req, res, next) => {
  try {
    const result = await catalogService.listProducts(req.query, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req, res, next) => {
  try {
    const result = await catalogService.createProduct(req.body, req.actor);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (req, res, next) => {
  try {
    const result = await catalogService.getProductById(req.params.id, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const result = await catalogService.updateProduct(req.params.id, req.body, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const archiveProduct = async (req, res, next) => {
  try {
    const result = await catalogService.archiveProduct(req.params.id, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const restoreProduct = async (req, res, next) => {
  try {
    const result = await catalogService.restoreProduct(req.params.id, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// ================= VARIANT CONTROLLER =================

export const addVariant = async (req, res, next) => {
  try {
    const result = await catalogService.addVariant(req.params.id, req.body, req.actor);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const updateVariant = async (req, res, next) => {
  try {
    const result = await catalogService.updateVariant(req.params.id, req.params.variantId, req.body, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const deactivateVariant = async (req, res, next) => {
  try {
    const result = await catalogService.deactivateVariant(req.params.id, req.params.variantId, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const activateVariant = async (req, res, next) => {
  try {
    const result = await catalogService.activateVariant(req.params.id, req.params.variantId, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// ================= SERVICE CONTROLLER =================

export const listServices = async (req, res, next) => {
  try {
    const result = await serviceCatalogService.listServices({
      ...req.query,
      actor: req.actor,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const createService = async (req, res, next) => {
  try {
    const result = await serviceCatalogService.createService(req.body, req.actor);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const getServiceById = async (req, res, next) => {
  try {
    const result = await serviceCatalogService.getServiceById(req.params.id, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const updateService = async (req, res, next) => {
  try {
    const result = await serviceCatalogService.updateService(req.params.id, req.body, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const archiveService = async (req, res, next) => {
  try {
    const result = await serviceCatalogService.archiveService(req.params.id, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getServiceBranches = async (req, res, next) => {
  try {
    const result = await serviceCatalogService.getServiceBranches(req.params.id, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
