const Booking = require('../models/Booking');
const Service = require('../models/Service');

const timeToMinutes = (timeString) => {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const minutes = (totalMinutes % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

const createBooking = async (req, res) => {
  try {
    const { salonId, stylistId, serviceId, slotTime, date } = req.body;
    const customerId = req.user._id;

    if (!date) {
      res.status(400).json({ error: 'date is required' });
      return;
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }

    const startMinutes = timeToMinutes(slotTime);
    const serviceDuration = service.duration;
    const endMinutes = startMinutes + serviceDuration;
    const endTime = minutesToTime(endMinutes);

    const existingBookings = await Booking.find({
      salonId,
      date,
      stylistId,
      status: 'booked'
    });

    const hasConflict = existingBookings.some(booking => {
      const bookingStart = timeToMinutes(booking.startTime);
      const bookingEnd = timeToMinutes(booking.endTime);
      return startMinutes < bookingEnd && endMinutes > bookingStart;
    });

    if (hasConflict) {
      res.status(400).json({ error: 'Time slot is no longer available' });
      return;
    }

    const newBooking = new Booking({
      salonId,
      stylistId,
      customerId,
      serviceId,
      date,
      startTime: slotTime,
      endTime
    });

    await newBooking.save();
    res.status(201).json({ message: 'Booking created successfully', booking: newBooking });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

const cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const currentUserId = req.user._id;
    const currentUserRole = req.user.role;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    if (booking.customerId.toString() !== currentUserId.toString() && currentUserRole !== 'admin') {
      res.status(403).json({ error: 'Not authorized to cancel this booking' });
      return;
    }

    if (booking.status === 'cancelled') {
      res.status(400).json({ error: 'Booking is already cancelled' });
      return;
    }

    booking.status = 'cancelled';
    await booking.save();

    res.json({ message: 'Booking cancelled successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { createBooking, cancelBooking };
