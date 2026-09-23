import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import * as bcrypt from 'bcrypt';

describe('Cash Flow RBAC (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  
  let tokenReadOnlyCashFlow: string;
  let tokenTransactionsOnly: string;
  let tokenNeither: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    
    prisma = app.get<PrismaService>(PrismaService);
    
    // Seed test roles and users
    const rcfRole = await prisma.role.create({
      data: { name: 'RCF_TEST_ROLE', description: 'Test Role' }
    });
    
    const rcfPerm = await prisma.permission.findFirst({ where: { name: 'READ_CASH_FLOW' } });
    if (rcfPerm) {
      await prisma.rolePermission.create({ data: { roleId: rcfRole.id, permissionId: rcfPerm.id } });
    }

    const tRole = await prisma.role.create({
      data: { name: 'T_TEST_ROLE', description: 'Test Role 2' }
    });
    const tPerm = await prisma.permission.findFirst({ where: { name: 'READ_TRANSACTIONS' } });
    if (tPerm) {
      await prisma.rolePermission.create({ data: { roleId: tRole.id, permissionId: tPerm.id } });
    }

    const noneRole = await prisma.role.create({
      data: { name: 'NONE_TEST_ROLE', description: 'Test Role 3' }
    });

    const password = await bcrypt.hash('password123', 10);
    
    const user1 = await prisma.user.create({
      data: { email: 'rcf@test.com', password, roleId: rcfRole.id }
    });
    
    const user2 = await prisma.user.create({
      data: { email: 't@test.com', password, roleId: tRole.id }
    });
    
    const user3 = await prisma.user.create({
      data: { email: 'none@test.com', password, roleId: noneRole.id }
    });

    // Login users to get tokens
    let res = await request(app.getHttpServer()).post('/auth/login').send({ email: 'rcf@test.com', password: 'password123' });
    tokenReadOnlyCashFlow = res.body.data.token;

    res = await request(app.getHttpServer()).post('/auth/login').send({ email: 't@test.com', password: 'password123' });
    tokenTransactionsOnly = res.body.data.token;

    res = await request(app.getHttpServer()).post('/auth/login').send({ email: 'none@test.com', password: 'password123' });
    tokenNeither = res.body.data.token;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.user.deleteMany({ where: { email: { in: ['rcf@test.com', 't@test.com', 'none@test.com'] } } });
    await prisma.role.deleteMany({ where: { name: { in: ['RCF_TEST_ROLE', 'T_TEST_ROLE', 'NONE_TEST_ROLE'] } } });
    await app.close();
  });

  it('GET /transactions - Anonymous should be 401', () => {
    return request(app.getHttpServer()).get('/transactions').expect(401);
  });

  it('GET /transactions - Neither permission should be 403', () => {
    return request(app.getHttpServer())
      .get('/transactions')
      .set('Authorization', `Bearer ${tokenNeither}`)
      .expect(403);
  });

  it('GET /transactions - READ_TRANSACTIONS only should be 200', () => {
    return request(app.getHttpServer())
      .get('/transactions')
      .set('Authorization', `Bearer ${tokenTransactionsOnly}`)
      .expect(200);
  });

  it('GET /transactions - READ_CASH_FLOW only should be 200', () => {
    return request(app.getHttpServer())
      .get('/transactions')
      .set('Authorization', `Bearer ${tokenReadOnlyCashFlow}`)
      .expect(200);
  });

  it('GET /financial-accounts/options - READ_CASH_FLOW only should be 200', () => {
    return request(app.getHttpServer())
      .get('/financial-accounts/options')
      .set('Authorization', `Bearer ${tokenReadOnlyCashFlow}`)
      .expect(200)
      .then(res => {
         // check fields
         if(res.body.data && res.body.data.length > 0) {
            expect(res.body.data[0].cachedBalance).toBeUndefined();
            expect(res.body.data[0].createdById).toBeUndefined();
         }
      });
  });

  it('GET /financial-accounts - READ_CASH_FLOW only should be 403 (ISOLATION TEST)', () => {
    return request(app.getHttpServer())
      .get('/financial-accounts')
      .set('Authorization', `Bearer ${tokenReadOnlyCashFlow}`)
      .expect(403);
  });
  
  it('GET /account-categories - READ_CASH_FLOW only should be 200', () => {
    return request(app.getHttpServer())
      .get('/account-categories')
      .set('Authorization', `Bearer ${tokenReadOnlyCashFlow}`)
      .expect(200);
  });
});
