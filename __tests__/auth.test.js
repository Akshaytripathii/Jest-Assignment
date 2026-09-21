const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

describe('Auth API Tests', () => {
    let mongoServer;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const connectionUri = mongoServer.getUri();
        await mongoose.connect(connectionUri);
    });

    afterEach(async () => {
        const collections = mongoose.connection.collections;
        for (const key in collections) {
            await collections[key].deleteMany({});
        }
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
        await mongoServer.stop();
    });

    describe('POST /api/register', () => {

        it('should successfully register a new user', async () => {
            const newUserData = {
                name: 'Test User',
                email: 'testuser@example.com',
                password: 'Password123'
            };

            const response = await request(app).post('/api/register').send(newUserData);

            expect(response.status).toBe(201);
            expect(response.body.message).toBe('User registered successfully');
        });

        it('should fail when email is already in use', async () => {
            const userData = {
                name: 'Original User',
                email: 'duplicate@example.com',
                password: 'Password123'
            };

            await request(app).post('/api/register').send(userData);
            const duplicateResponse = await request(app).post('/api/register').send(userData);

            expect(duplicateResponse.status).toBe(400);
            expect(duplicateResponse.body.error).toBe('Email already in use');
        });

        it('should fail when password is missing', async () => {
            const incompleteUserData = {
                name: 'Test User',
                email: 'testuser2@example.com'
            };

            const response = await request(app).post('/api/register').send(incompleteUserData);

            expect(response.status).toBe(500);
            expect(response.body.error).toBe('Server error');
        });

        it('should fail when name is missing', async () => {
            const incompleteUserData = {
                email: 'noname@example.com',
                password: 'Password123'
            };

            const response = await request(app).post('/api/register').send(incompleteUserData);

            expect(response.status).toBe(500);
            expect(response.body.error).toBe('Server error');
        });

        it('should fail when email is missing', async () => {
            const incompleteUserData = {
                name: 'No Email User',
                password: 'Password123'
            };

            const response = await request(app).post('/api/register').send(incompleteUserData);

            expect(response.status).toBe(500);
            expect(response.body.error).toBe('Server error');
        });

    });

    describe('POST /api/login', () => {

        beforeEach(async () => {
            await request(app).post('/api/register').send({
                name: 'Login Test User',
                email: 'logintest@example.com',
                password: 'CorrectPassword'
            });
        });

        it('should successfully login with correct credentials', async () => {
            const response = await request(app).post('/api/login').send({
                email: 'logintest@example.com',
                password: 'CorrectPassword'
            });

            expect(response.status).toBe(200);
            expect(response.body.token).toBeDefined();
            expect(response.body.role).toBe('customer');
        });

        it('should fail when the email does not exist', async () => {
            const response = await request(app).post('/api/login').send({
                email: 'ghost@example.com',
                password: 'SomePassword'
            });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid credentials');
        });

        it('should fail when the password is wrong', async () => {
            const response = await request(app).post('/api/login').send({
                email: 'logintest@example.com',
                password: 'WrongPassword'
            });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid credentials');
        });

    });

    describe('Authorization middleware', () => {

        it('should reject POST /api/bookings with no token', async () => {
            const response = await request(app).post('/api/bookings').send({});

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        it('should reject POST /api/bookings with an invalid token', async () => {
            const response = await request(app)
                .post('/api/bookings')
                .set('Authorization', 'Bearer this.is.not.valid')
                .send({});

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Invalid token');
        });

        it('should reject POST /api/bookings/:id/cancel with no token', async () => {
            const fakeBookingId = new mongoose.Types.ObjectId().toString();
            const response = await request(app).post(`/api/bookings/${fakeBookingId}/cancel`);

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        it('should allow POST /api/bookings with a valid token', async () => {
            await request(app).post('/api/register').send({
                name: 'Auth Check User',
                email: 'authcheck@example.com',
                password: 'Password123'
            });

            const loginResponse = await request(app).post('/api/login').send({
                email: 'authcheck@example.com',
                password: 'Password123'
            });
            const validToken = loginResponse.body.token;

            const response = await request(app)
                .post('/api/bookings')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    salonId: new mongoose.Types.ObjectId().toString(),
                    stylistId: new mongoose.Types.ObjectId().toString(),
                    serviceId: new mongoose.Types.ObjectId().toString(),
                    slotTime: '10:00',
                    date: '2026-10-10'
                });

            expect(response.status).not.toBe(401);
        });

    });

});
