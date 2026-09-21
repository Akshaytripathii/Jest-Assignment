const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  duration: { type: Number, required: true },
  price: { type: Number, required: true },
  salonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Salon', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);
