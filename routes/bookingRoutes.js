const express = require('express');
const { createBooking, cancelBooking } = require('../controllers/bookingController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/bookings', authMiddleware, createBooking);
router.post('/bookings/:bookingId/cancel', authMiddleware, cancelBooking);

module.exports = router;
