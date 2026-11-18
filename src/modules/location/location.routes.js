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

// GET /api/v1/locations/districts?province=
router.get('/districts', (req, res) => {
  const provinceParam = req.query.province || req.query.provinceCode || req.query.province_code || '79';
  const data = getDistricts(provinceParam, { q: req.query.q });
  res.json({
    success: true,
    data,
    total: data.length,
  });
});

// GET /api/v1/locations/wards?district=&province=
router.get('/wards', (req, res) => {
  const districtParam = req.query.district || req.query.districtCode || req.query.district_code || '760';
  const provinceParam = req.query.province || req.query.provinceCode || req.query.province_code || '';
  const data = getWards(districtParam, { q: req.query.q, provinceCode: provinceParam });
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

