const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Salon = require('../models/Salon');
const Service = require('../models/Service');
const Booking = require('../models/Booking');

dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/salon-db';

const seedDatabase = async () => {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to DB for seeding...');

    await User.deleteMany({});
    await Salon.deleteMany({});
    await Service.deleteMany({});
    await Booking.deleteMany({});

    const hashedAdminPassword = await bcrypt.hash('admin123', 10);
    const adminUser = new User({
      name: 'Admin User',
      email: 'admin@salon.com',
      password: hashedAdminPassword,
      role: 'admin'
    });
    await adminUser.save();

    const hashedStylistPassword = await bcrypt.hash('stylist123', 10);
    const firstStylist = new User({
      name: 'John Doe',
      email: 'john@salon.com',
      password: hashedStylistPassword,
      role: 'stylist'
    });
    const secondStylist = new User({
      name: 'Jane Smith',
      email: 'jane@salon.com',
      password: hashedStylistPassword,
      role: 'stylist'
    });
    await firstStylist.save();
    await secondStylist.save();

    const salon = new Salon({
      name: 'Elegant Beauty Salon',
      location: '123 Main Street',
      openTime: '09:00',
      closeTime: '18:00'
    });
    await salon.save();

    const haircutService = new Service({
      name: 'Men Haircut',
      duration: 30,
      price: 25,
      salonId: salon._id
    });
    const coloringService = new Service({
      name: 'Women Hair Coloring',
      duration: 60,
      price: 80,
      salonId: salon._id
    });
    await haircutService.save();
    await coloringService.save();

    console.log('Database seeded successfully!');
    console.log('--- Seed Info ---');
    console.log('Admin Email:', adminUser.email);
    console.log('Stylist 1 Email:', firstStylist.email, 'ID:', firstStylist._id.toString());
    console.log('Stylist 2 Email:', secondStylist.email, 'ID:', secondStylist._id.toString());
    console.log('Salon ID:', salon._id.toString());
    console.log(`Service '${haircutService.name}' ID:`, haircutService._id.toString());
    console.log(`Service '${coloringService.name}' ID:`, coloringService._id.toString());

    process.exit(0);
  } catch (error) {
    console.error('Error seeding DB:', error);
    process.exit(1);
  }
};

seedDatabase();
