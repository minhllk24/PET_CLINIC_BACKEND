import express from 'express';
import StaffProfile from './models/StaffProfile';
import Shift from './models/Shift';

const router = express.Router();

// Staff profiles
router.get('/', async (req, res, next) => {
  try {
    const staff = await StaffProfile.find();
    res.json(staff);
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const staff = new StaffProfile(req.body);
    await staff.save();
    res.status(201).json(staff);
  } catch (error) { next(error); }
});

// Shifts
router.get('/:staffId/shifts', async (req, res, next) => {
  try {
    const shifts = await Shift.find({ staffId: req.params.staffId });
    res.json(shifts);
  } catch (error) { next(error); }
});

router.post('/:staffId/shifts', async (req, res, next) => {
  try {
    const shift = new Shift({ ...req.body, staffId: req.params.staffId });
    await shift.save();
    res.status(201).json(shift);
  } catch (error) { next(error); }
});

export default router;
