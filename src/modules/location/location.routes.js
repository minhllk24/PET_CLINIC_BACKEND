import express from 'express';
import { getProvinces, getDistricts, getWards } from './location.service.js';

const router = express.Router();

// GET /api/v1/locations/provinces?q=
router.get('/provinces', (req, res) => {
  const data = getProvinces({ q: req.query.q });
  res.json({
    success: true,
    data,
    total: data.length,
  });
});

// GET /api/v1/locations/provinces/:provinceCode/districts?q=
router.get('/provinces/:provinceCode/districts', (req, res) => {
  const data = getDistricts(req.params.provinceCode, { q: req.query.q });
  res.json({
    success: true,
    data,
    total: data.length,
  });
});

// GET /api/v1/locations/districts/:districtCode/wards?q=
router.get('/districts/:districtCode/wards', (req, res) => {
  const data = getWards(req.params.districtCode, { q: req.query.q });
  res.json({
    success: true,
    data,
    total: data.length,
  });
});

export default router;

