const mongoose = require('mongoose');

const salonSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  openTime: { type: String, required: true },
  closeTime: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Salon', salonSchema);
