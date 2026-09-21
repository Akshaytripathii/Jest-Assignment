const express = require('express');
const { getAvailableSlots } = require('../controllers/salonController');

const router = express.Router();

router.get('/salons/:salonId/available-slots', getAvailableSlots);

module.exports = router;
