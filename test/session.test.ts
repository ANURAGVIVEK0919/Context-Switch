import request from 'supertest';
import { app } from '../src/server';
import db from '../src/db';

describe('Session Scoping', () => {
  let token1: string;
  let token2: string;
  let userId1: number;
  let userId2: number;

  beforeAll(async () => {
    // Reset DB
    db.prepare('DELETE FROM users').run();
    db.prepare('DELETE FROM sessions').run();
    db.prepare('DELETE FROM events').run();

    // Register User 1
    const res1 = await request(app).post('/auth/register').send({ email: 'u1@ex.com', password: 'p1' });
    token1 = res1.body.token;
    userId1 = res1.body.user.id;

    // Register User 2
    const res2 = await request(app).post('/auth/register').send({ email: 'u2@ex.com', password: 'p2' });
    token2 = res2.body.token;
    userId2 = res2.body.user.id;
  });

  it('should start a session for User 1', async () => {
    const res = await request(app)
      .post('/session/start')
      .set('Authorization', `Bearer ${token1}`)
      .send({ project: 'ProjA' });
    
    expect(res.status).toBe(201);
    expect(res.body.session.sessionId).toBeDefined();
  });

  it('User 2 should see 0 active sessions', async () => {
    const res = await request(app)
      .get('/session/active')
      .set('Authorization', `Bearer ${token2}`);
    
    expect(res.status).toBe(200);
    expect(res.body.activeProjectsCount).toBe(0);
  });

  it('User 1 should see 1 active session', async () => {
    const res = await request(app)
      .get('/session/active')
      .set('Authorization', `Bearer ${token1}`);
    
    expect(res.status).toBe(200);
    expect(res.body.activeProjectsCount).toBe(1);
    expect(res.body.activeProjects[0].project).toBe('ProjA');
  });

  it('should ingest events only for the authenticated user', async () => {
    // User 1 ingests an event
    await request(app)
      .post('/session/events/ingest')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        events: [{
          type: 'file:save',
          filePath: 'src/main.ts',
          project: 'ProjA',
          timestamp: Date.now()
        }]
      });

    // Check that User 2 cannot see User 1's events
    // We'll need a sessionId for User 1 to check /session/:id/events, 
    // but User 2 shouldn't even be able to access that session ID if we implement it strictly.
    
    const active1 = await request(app).get('/session/active').set('Authorization', `Bearer ${token1}`);
    const sid1 = active1.body.activeProjects[0].sessions[0].id;

    const resAccess = await request(app)
      .get(`/session/${sid1}/events`)
      .set('Authorization', `Bearer ${token2}`);
    
    expect(resAccess.status).toBe(403); // Forbidden
  });
});
