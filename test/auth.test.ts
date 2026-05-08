import request from 'supertest';
import { app } from '../src/server';
import db from '../src/db';

describe('Auth Endpoints', () => {
  beforeAll(() => {
    // Clean up test DB
    db.prepare('DELETE FROM users').run();
  });

  const testUser = {
    email: 'test@example.com',
    password: 'password123'
  };

  it('should register a new user', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send(testUser);
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(testUser.email);
  });

  it('should not register the same user twice', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send(testUser);
    
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should login successfully', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send(testUser);
    
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(testUser.email);
  });

  it('should fail login with wrong password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: 'wrongpassword'
      });
    
    expect(res.status).toBe(401);
  });
});
