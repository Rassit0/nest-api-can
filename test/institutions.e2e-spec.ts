import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../src/auth/guards/user-role/user-role.guard';

describe('InstitutionsController (e2e)', () => {
  let app: INestApplication;

  const mockAuthGuard = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      if (req.headers.authorization === 'Bearer VALID_TOKEN_NO_PERMS') {
        req.user = { id: 'user1', email: 'user1@test.com' };
        return true;
      }
      if (req.headers.authorization === 'Bearer VALID_TOKEN_WITH_PERMS') {
        req.user = { id: 'user2', email: 'user2@test.com' };
        return true;
      }
      throw new UnauthorizedException(); // Unauthorized for everything else
    },
  };

  const mockRoleGuard = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      const requiredPermissions = Reflect.getMetadata('permissions', context.getHandler()) || [];
      
      // No permissions required
      if (requiredPermissions.length === 0) {
        return true; 
      }

      // Check perms based on token
      if (req.headers.authorization === 'Bearer VALID_TOKEN_WITH_PERMS') {
        return true; // Has all perms
      }
      
      if (req.headers.authorization === 'Bearer VALID_TOKEN_NO_PERMS') {
        return false; // Has no perms
      }

      return false;
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
    .overrideGuard(AuthGuard('jwt'))
    .useValue(mockAuthGuard)
    .overrideGuard(UserRoleGuard)
    .useValue(mockRoleGuard)
    .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /institutions/context', () => {
    it('should return 401 for anonymous users', () => {
      return request(app.getHttpServer())
        .get('/institutions/context')
        .expect(401);
    });

    it('should return 200 for authenticated user WITHOUT READ_INSTITUTIONS', async () => {
      const res = await request(app.getHttpServer())
        .get('/institutions/context')
        .set('Authorization', 'Bearer VALID_TOKEN_NO_PERMS')
        .expect(200);
      
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('name');
      expect(res.body.data).toHaveProperty('imageUrl');
      // Should not expose other fields
      expect(res.body.data).not.toHaveProperty('address');
      expect(res.body.data).not.toHaveProperty('createdAt');
    });

    it('should return 200 for authenticated user WITH READ_INSTITUTIONS', () => {
      return request(app.getHttpServer())
        .get('/institutions/context')
        .set('Authorization', 'Bearer VALID_TOKEN_WITH_PERMS')
        .expect(200);
    });
  });

  describe('GET /institutions', () => {
    it('should return 403 for authenticated user WITHOUT READ_INSTITUTIONS', () => {
      return request(app.getHttpServer())
        .get('/institutions')
        .set('Authorization', 'Bearer VALID_TOKEN_NO_PERMS')
        .expect(403);
    });

    it('should return 200 for authenticated user WITH READ_INSTITUTIONS', () => {
      return request(app.getHttpServer())
        .get('/institutions')
        .set('Authorization', 'Bearer VALID_TOKEN_WITH_PERMS')
        .expect(200);
    });
  });

  describe('Route resolution check', () => {
    it('/institutions/context is NOT caught by /institutions/:id', async () => {
      // If it was caught by :id, it would require READ_INSTITUTIONS.
      // And with NO_PERMS, it would return 403 instead of 200.
      await request(app.getHttpServer())
        .get('/institutions/context')
        .set('Authorization', 'Bearer VALID_TOKEN_NO_PERMS')
        .expect(200); // Proves it hit /context, not /:id (which gives 403)
    });
  });
});
