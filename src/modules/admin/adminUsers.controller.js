import * as adminUsersService from './adminUsers.service';

export const listUsers = async (req, res, next) => {
  try {
    const result = await adminUsersService.listUsers(req.query, req.actor);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const user = await adminUsersService.getUserById(req.params.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const user = await adminUsersService.createUser(req.body, req.actor);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const user = await adminUsersService.updateUser(req.params.id, req.body, req.actor);
    res.json(user);
  } catch (err) {
    next(err);
  }
};

export const updateUserStatus = async (req, res, next) => {
  try {
    const user = await adminUsersService.updateUserStatus(req.params.id, req.body, req.actor);
    res.json(user);
  } catch (err) {
    next(err);
  }
};

export const updateUserRole = async (req, res, next) => {
  try {
    const user = await adminUsersService.updateUserRole(req.params.id, req.body, req.actor);
    res.json(user);
  } catch (err) {
    next(err);
  }
};

