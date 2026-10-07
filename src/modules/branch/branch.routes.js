import express from 'express';
import Branch from './models/Branch';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const branches = await Branch.find({ status: 'ACTIVE' });
    res.json(branches);
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const branch = new Branch(req.body);
    await branch.save();
    res.status(201).json(branch);
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) return res.status(404).json({ error: 'Not found' });
    res.json(branch);
  } catch (error) { next(error); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const branch = await Branch.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!branch) return res.status(404).json({ error: 'Not found' });
    res.json(branch);
  } catch (error) { next(error); }
});

export default router;
