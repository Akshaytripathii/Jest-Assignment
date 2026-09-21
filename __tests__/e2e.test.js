const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Service = require('../models/Service');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

jest.setTimeout(60000);

describe('End-to-End Salon Booking Journey', () => {
    let mongoServer;
    let serviceId;
    let validSalonId;
    let validStylistId;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const connectionUri = mongoServer.getUri();
        await mongoose.connect(connectionUri);

        validSalonId = new mongoose.Types.ObjectId().toString();
        validStylistId = new mongoose.Types.ObjectId().toString();

        const testService = new Service({
            name: 'Test Haircut',
            duration: 30,
            price: 50,
            salonId: validSalonId
        });
        await testService.save();
        serviceId = testService._id.toString();
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
        await mongoServer.stop();
    });

    const registerAndLogin = async (email, password = 'password123', name = 'Test User') => {
        await request(app).post('/api/register').send({ name, email, password });
        const loginResponse = await request(app).post('/api/login').send({ email, password });
        return loginResponse.body.token;
    };

    it('should successfully complete the entire booking lifecycle', async () => {
        const authToken = await registerAndLogin('e2e@example.com');

        const bookingResponse = await request(app)
            .post('/api/bookings')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                salonId: validSalonId,
                stylistId: validStylistId,
                serviceId,
                slotTime: '10:00',
                date: '2026-10-10'
            });

        expect(bookingResponse.status).toBe(201);
        expect(bookingResponse.body.booking).toBeDefined();

        const createdBookingId = bookingResponse.body.booking._id;

        const cancelResponse = await request(app)
            .post(`/api/bookings/${createdBookingId}/cancel`)
            .set('Authorization', `Bearer ${authToken}`);

        expect(cancelResponse.status).toBe(200);
        expect(cancelResponse.body.message).toBe('Booking cancelled successfully');
    });

    describe('Registration failures', () => {

        it('should fail to register when email is already taken', async () => {
            await request(app).post('/api/register').send({
                name: 'First User',
                email: 'taken@example.com',
                password: 'password123'
            });

            const duplicateResponse = await request(app).post('/api/register').send({
                name: 'Second User',
                email: 'taken@example.com',
                password: 'password456'
            });

            expect(duplicateResponse.status).toBe(400);
            expect(duplicateResponse.body.error).toBe('Email already in use');
        });

        it('should fail to register when password is missing', async () => {
            const response = await request(app).post('/api/register').send({
                name: 'No Password',
                email: 'nopassword@example.com'
            });

            expect(response.status).toBe(500);
            expect(response.body.error).toBe('Server error');
        });

    });

    describe('Login failures', () => {

        it('should fail to login with an email that is not registered', async () => {
            const response = await request(app).post('/api/login').send({
                email: 'nobody@example.com',
                password: 'password123'
            });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid credentials');
        });

        it('should fail to login with a wrong password', async () => {
            await request(app).post('/api/register').send({
                name: 'Wrong Pass User',
                email: 'wrongpass@example.com',
                password: 'correctpassword'
            });

            const response = await request(app).post('/api/login').send({
                email: 'wrongpass@example.com',
                password: 'wrongpassword'
            });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid credentials');
        });

    });

    describe('Booking validation failures', () => {

        it('should fail to create a booking when date is missing', async () => {
            const authToken = await registerAndLogin('nodate@example.com');

            const response = await request(app)
                .post('/api/bookings')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    salonId: validSalonId,
                    stylistId: validStylistId,
                    serviceId,
                    slotTime: '10:00'
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('date is required');
        });

        it('should fail to create a booking when service does not exist', async () => {
            const authToken = await registerAndLogin('badservice@example.com');

            const response = await request(app)
                .post('/api/bookings')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    salonId: validSalonId,
                    stylistId: validStylistId,
                    serviceId: new mongoose.Types.ObjectId().toString(),
                    slotTime: '10:00',
                    date: '2026-10-10'
                });

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Service not found');
        });

        it('should fail to create a booking when the time slot is already taken', async () => {
            const firstUserToken = await registerAndLogin('firstbooker@example.com');
            const secondUserToken = await registerAndLogin('secondbooker@example.com');

            const sharedBookingDetails = {
                salonId: validSalonId,
                stylistId: validStylistId,
                serviceId,
                slotTime: '11:00',
                date: '2026-10-11'
            };

            const firstBooking = await request(app)
                .post('/api/bookings')
                .set('Authorization', `Bearer ${firstUserToken}`)
                .send(sharedBookingDetails);

            expect(firstBooking.status).toBe(201);

            const conflictingBooking = await request(app)
                .post('/api/bookings')
                .set('Authorization', `Bearer ${secondUserToken}`)
                .send(sharedBookingDetails);

            expect(conflictingBooking.status).toBe(400);
            expect(conflictingBooking.body.error).toBe('Time slot is no longer available');
        });

        it('should fail to create a booking without a token', async () => {
            const response = await request(app)
                .post('/api/bookings')
                .send({
                    salonId: validSalonId,
                    stylistId: validStylistId,
                    serviceId,
                    slotTime: '10:00',
                    date: '2026-10-10'
                });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

    });

    describe('Cancellation authorization', () => {

        it('should fail to cancel a booking that belongs to another user', async () => {
            const ownerToken = await registerAndLogin('owner@example.com');
            const intruderToken = await registerAndLogin('intruder@example.com');

            const bookingResponse = await request(app)
                .post('/api/bookings')
                .set('Authorization', `Bearer ${ownerToken}`)
                .send({
                    salonId: validSalonId,
                    stylistId: validStylistId,
                    serviceId,
                    slotTime: '12:00',
                    date: '2026-10-12'
                });

            expect(bookingResponse.status).toBe(201);
            const bookingId = bookingResponse.body.booking._id;

            const cancelResponse = await request(app)
                .post(`/api/bookings/${bookingId}/cancel`)
                .set('Authorization', `Bearer ${intruderToken}`);

            expect(cancelResponse.status).toBe(403);
            expect(cancelResponse.body.error).toBe('Not authorized to cancel this booking');
        });

        it('should fail to cancel a booking that is already cancelled', async () => {
            const authToken = await registerAndLogin('doublecanceller@example.com');

            const bookingResponse = await request(app)
                .post('/api/bookings')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    salonId: validSalonId,
                    stylistId: validStylistId,
                    serviceId,
                    slotTime: '13:00',
                    date: '2026-10-13'
                });

            expect(bookingResponse.status).toBe(201);
            const bookingId = bookingResponse.body.booking._id;

            await request(app)
                .post(`/api/bookings/${bookingId}/cancel`)
                .set('Authorization', `Bearer ${authToken}`);

            const secondCancelResponse = await request(app)
                .post(`/api/bookings/${bookingId}/cancel`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(secondCancelResponse.status).toBe(400);
            expect(secondCancelResponse.body.error).toBe('Booking is already cancelled');
        });

        it('should fail to cancel a booking that does not exist', async () => {
            const authToken = await registerAndLogin('ghostcanceller@example.com');
            const nonExistentBookingId = new mongoose.Types.ObjectId().toString();

            const response = await request(app)
                .post(`/api/bookings/${nonExistentBookingId}/cancel`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Booking not found');
        });

        it('should fail to cancel a booking without a token', async () => {
            const phantomBookingId = new mongoose.Types.ObjectId().toString();

            const response = await request(app)
                .post(`/api/bookings/${phantomBookingId}/cancel`);

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        it('should allow an admin to cancel another user\'s booking', async () => {
            const customerToken = await registerAndLogin('customer@example.com');

            const hashedAdminPassword = await bcrypt.hash('admin123', 10);
            const adminUser = new User({
                name: 'Admin',
                email: 'admin@example.com',
                password: hashedAdminPassword,
                role: 'admin'
            });
            await adminUser.save();

            const adminLoginResponse = await request(app).post('/api/login').send({
                email: 'admin@example.com',
                password: 'admin123'
            });
            const adminToken = adminLoginResponse.body.token;

            const bookingResponse = await request(app)
                .post('/api/bookings')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    salonId: validSalonId,
                    stylistId: validStylistId,
                    serviceId,
                    slotTime: '14:00',
                    date: '2026-10-14'
                });

            expect(bookingResponse.status).toBe(201);
            const bookingId = bookingResponse.body.booking._id;

            const adminCancelResponse = await request(app)
                .post(`/api/bookings/${bookingId}/cancel`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(adminCancelResponse.status).toBe(200);
            expect(adminCancelResponse.body.message).toBe('Booking cancelled successfully');
        });

    });

});
