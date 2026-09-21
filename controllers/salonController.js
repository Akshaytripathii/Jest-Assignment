const Salon = require('../models/Salon');
const Service = require('../models/Service');
const Booking = require('../models/Booking');
const User = require('../models/User');

const timeToMinutes = (timeString) => {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const minutes = (totalMinutes % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

const getAvailableSlots = async (req, res) => {
  try {
    const { salonId } = req.params;
    const { date, serviceId } = req.query;

    if (!date || !serviceId) {
      res.status(400).json({ error: 'date and serviceId are required' });
      return;
    }

    const salon = await Salon.findById(salonId);
    const service = await Service.findById(serviceId);

    if (!salon || !service) {
      res.status(404).json({ error: 'Salon or Service not found' });
      return;
    }

    const stylists = await User.find({ role: 'stylist' });

    const existingBookings = await Booking.find({
      salonId,
      date,
      status: 'booked'
    });

    const openingMinutes = timeToMinutes(salon.openTime);
    const closingMinutes = timeToMinutes(salon.closeTime);
    const serviceDuration = service.duration;

    const availableSlots = [];

    for (let slotStartMinutes = openingMinutes; slotStartMinutes + serviceDuration <= closingMinutes; slotStartMinutes += 30) {
      const slotStartTime = minutesToTime(slotStartMinutes);

      for (const stylist of stylists) {
        const hasConflict = existingBookings.some(booking => {
          if (booking.stylistId.toString() !== stylist._id.toString()) return false;

          const bookingStart = timeToMinutes(booking.startTime);
          const bookingEnd = timeToMinutes(booking.endTime);

          return slotStartMinutes < bookingEnd && (slotStartMinutes + serviceDuration) > bookingStart;
        });

        if (!hasConflict) {
          availableSlots.push({
            time: slotStartTime,
            stylistId: stylist._id,
            stylistName: stylist.name
          });
        }
      }
    }

    res.json({ date, service: service.name, duration: serviceDuration, availableSlots });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { getAvailableSlots };
