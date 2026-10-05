import servicePricingAPIService from '../services/servicePricingAPIService';

const getPricingMatrix = async (req, res) => {
  try {
    const data = await servicePricingAPIService.getPricingMatrix();
    return res.status(200).json({
      EM: data.EM,
      EC: data.EC,
      DT: data.DT
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({
      EM: 'error from server',
      EC: -1,
      DT: ''
    });
  }
};

module.exports = {
  getPricingMatrix
};
