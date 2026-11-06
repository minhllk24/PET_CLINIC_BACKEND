import * as managerService from './manager.service.js';

export const listManagers = async (req, res, next) => {
  try {
    const result = await managerService.listManagers(req.query, req.actor);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getManagerById = async (req, res, next) => {
  try {
    const result = await managerService.getManagerById(req.params.id, req.actor);
    res.status(200).json({
      success: true,
      data: result,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const createManager = async (req, res, next) => {
  try {
    const result = await managerService.createManager(req.body, req.actor);
    res.status(201).json({
      success: true,
      data: result,
      ...result,
      message: 'Tạo tài khoản Quản lý thành công',
    });
  } catch (error) {
    next(error);
  }
};

export const updateManager = async (req, res, next) => {
  try {
    const result = await managerService.updateManager(req.params.id, req.body, req.actor);
    res.status(200).json({
      success: true,
      data: result,
      ...result,
      message: 'Cập nhật thông tin Quản lý thành công',
    });
  } catch (error) {
    next(error);
  }
};

export const updateManagerBranches = async (req, res, next) => {
  try {
    const result = await managerService.updateManagerBranches(req.params.id, req.body, req.actor);
    res.status(200).json({
      success: true,
      data: result,
      ...result,
      message: 'Cập nhật danh sách chi nhánh quản lý thành công',
    });
  } catch (error) {
    next(error);
  }
};

export const resetManagerPassword = async (req, res, next) => {
  try {
    const result = await managerService.resetManagerPassword(req.params.id, req.body, req.actor);
    res.status(200).json({
      success: true,
      data: result,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

