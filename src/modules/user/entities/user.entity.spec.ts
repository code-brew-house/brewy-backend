import { validate } from 'class-validator';
import { User } from './user.entity';
import { UserRole } from '../types/user.types';

describe('User Entity', () => {
  let validUser: User;

  beforeEach(() => {
    validUser = new User();
    validUser.id = '123e4567-e89b-12d3-a456-426614174000';
    validUser.username = 'testuser';
    validUser.email = 'test@example.com';
    validUser.password = 'password123';
    validUser.fullName = 'Test User';
    validUser.organizationId = '123e4567-e89b-12d3-a456-426614174001';
    validUser.role = 'ADMIN';
    validUser.createdAt = new Date();
    validUser.updatedAt = new Date();
  });

  describe('Entity instantiation', () => {
    it('should create a user entity instance', () => {
      const user = new User();
      expect(user).toBeInstanceOf(User);
    });

    it('should allow setting all properties', () => {
      expect(validUser.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(validUser.username).toBe('testuser');
      expect(validUser.email).toBe('test@example.com');
      expect(validUser.password).toBe('password123');
      expect(validUser.fullName).toBe('Test User');
      expect(validUser.organizationId).toBe(
        '123e4567-e89b-12d3-a456-426614174001',
      );
      expect(validUser.role).toBe('ADMIN');
      expect(validUser.createdAt).toBeInstanceOf(Date);
      expect(validUser.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('Validation', () => {
    describe('id validation', () => {
      it('should pass validation with valid UUID', async () => {
        const errors = await validate(validUser);
        const idErrors = errors.filter((error) => error.property === 'id');
        expect(idErrors).toHaveLength(0);
      });

      it('should fail validation with invalid UUID', async () => {
        validUser.id = 'invalid-uuid';
        const errors = await validate(validUser);
        const idErrors = errors.filter((error) => error.property === 'id');
        expect(idErrors.length).toBeGreaterThan(0);
        expect(idErrors[0]?.constraints?.isUuid).toBeDefined();
      });

      it('should fail validation with empty id', async () => {
        validUser.id = '';
        const errors = await validate(validUser);
        const idErrors = errors.filter((error) => error.property === 'id');
        expect(idErrors.length).toBeGreaterThan(0);
      });
    });

    describe('username validation', () => {
      it('should pass validation with valid username', async () => {
        validUser.username = 'validuser123';
        const errors = await validate(validUser);
        const usernameErrors = errors.filter(
          (error) => error.property === 'username',
        );
        expect(usernameErrors).toHaveLength(0);
      });

      it('should fail validation with username less than 3 characters', async () => {
        validUser.username = 'ab';
        const errors = await validate(validUser);
        const usernameErrors = errors.filter(
          (error) => error.property === 'username',
        );
        expect(usernameErrors.length).toBeGreaterThan(0);
        expect(usernameErrors[0]?.constraints?.minLength).toContain(
          'Username must be at least 3 characters long',
        );
      });

      it('should fail validation with non-string username', async () => {
        (validUser as any).username = 123;
        const errors = await validate(validUser);
        const usernameErrors = errors.filter(
          (error) => error.property === 'username',
        );
        expect(usernameErrors.length).toBeGreaterThan(0);
        expect(usernameErrors[0]?.constraints?.isString).toBeDefined();
      });
    });

    describe('email validation', () => {
      it('should pass validation with valid email', async () => {
        validUser.email = 'valid@example.com';
        const errors = await validate(validUser);
        const emailErrors = errors.filter(
          (error) => error.property === 'email',
        );
        expect(emailErrors).toHaveLength(0);
      });

      it('should fail validation with invalid email format', async () => {
        validUser.email = 'invalid-email';
        const errors = await validate(validUser);
        const emailErrors = errors.filter(
          (error) => error.property === 'email',
        );
        expect(emailErrors.length).toBeGreaterThan(0);
        expect(emailErrors[0]?.constraints?.isEmail).toContain(
          'Please provide a valid email address',
        );
      });

      it('should fail validation with empty email', async () => {
        validUser.email = '';
        const errors = await validate(validUser);
        const emailErrors = errors.filter(
          (error) => error.property === 'email',
        );
        expect(emailErrors.length).toBeGreaterThan(0);
      });
    });

    describe('password validation', () => {
      it('should pass validation with valid password', async () => {
        validUser.password = 'strongpassword123';
        const errors = await validate(validUser);
        const passwordErrors = errors.filter(
          (error) => error.property === 'password',
        );
        expect(passwordErrors).toHaveLength(0);
      });

      it('should fail validation with password less than 8 characters', async () => {
        validUser.password = '1234567';
        const errors = await validate(validUser);
        const passwordErrors = errors.filter(
          (error) => error.property === 'password',
        );
        expect(passwordErrors.length).toBeGreaterThan(0);
        expect(passwordErrors[0]?.constraints?.minLength).toContain(
          'Password must be at least 8 characters long',
        );
      });

      it('should fail validation with non-string password', async () => {
        (validUser as any).password = 12345678;
        const errors = await validate(validUser);
        const passwordErrors = errors.filter(
          (error) => error.property === 'password',
        );
        expect(passwordErrors.length).toBeGreaterThan(0);
        expect(passwordErrors[0]?.constraints?.isString).toBeDefined();
      });
    });

    describe('fullName validation', () => {
      it('should pass validation with valid full name', async () => {
        validUser.fullName = 'John Doe';
        const errors = await validate(validUser);
        const fullNameErrors = errors.filter(
          (error) => error.property === 'fullName',
        );
        expect(fullNameErrors).toHaveLength(0);
      });

      it('should fail validation with empty full name', async () => {
        validUser.fullName = '';
        const errors = await validate(validUser);
        const fullNameErrors = errors.filter(
          (error) => error.property === 'fullName',
        );
        expect(fullNameErrors.length).toBeGreaterThan(0);
        expect(fullNameErrors[0]?.constraints?.minLength).toContain(
          'Full name is required',
        );
      });

      it('should fail validation with non-string full name', async () => {
        (validUser as any).fullName = 123;
        const errors = await validate(validUser);
        const fullNameErrors = errors.filter(
          (error) => error.property === 'fullName',
        );
        expect(fullNameErrors.length).toBeGreaterThan(0);
        expect(fullNameErrors[0]?.constraints?.isString).toBeDefined();
      });
    });

    describe('organizationId validation', () => {
      it('should pass validation with valid organization UUID', async () => {
        const errors = await validate(validUser);
        const orgIdErrors = errors.filter(
          (error) => error.property === 'organizationId',
        );
        expect(orgIdErrors).toHaveLength(0);
      });

      it('should fail validation with invalid organization UUID', async () => {
        validUser.organizationId = 'invalid-uuid';
        const errors = await validate(validUser);
        const orgIdErrors = errors.filter(
          (error) => error.property === 'organizationId',
        );
        expect(orgIdErrors.length).toBeGreaterThan(0);
        expect(orgIdErrors[0]?.constraints?.isUuid).toBeDefined();
      });
    });

    describe('role validation', () => {
      it('should pass validation with valid roles', async () => {
        const validRoles: UserRole[] = [
          'SUPER_OWNER',
          'OWNER',
          'ADMIN',
          'AGENT',
        ];

        for (const role of validRoles) {
          validUser.role = role;
          const errors = await validate(validUser);
          const roleErrors = errors.filter(
            (error) => error.property === 'role',
          );
          expect(roleErrors).toHaveLength(0);
        }
      });

      it('should fail validation with invalid role', async () => {
        (validUser as any).role = 'INVALID_ROLE';
        const errors = await validate(validUser);
        const roleErrors = errors.filter((error) => error.property === 'role');
        expect(roleErrors.length).toBeGreaterThan(0);
        expect(roleErrors[0]?.constraints?.isIn).toContain(
          'Role must be one of: SUPER_OWNER, OWNER, ADMIN, AGENT',
        );
      });

      it('should fail validation with non-string role', async () => {
        (validUser as any).role = 123;
        const errors = await validate(validUser);
        const roleErrors = errors.filter((error) => error.property === 'role');
        expect(roleErrors.length).toBeGreaterThan(0);
        expect(roleErrors[0]?.constraints?.isString).toBeDefined();
      });
    });

    describe('date validation', () => {
      it('should pass validation with valid dates', async () => {
        validUser.createdAt = new Date();
        validUser.updatedAt = new Date();
        const errors = await validate(validUser);
        const dateErrors = errors.filter(
          (error) =>
            error.property === 'createdAt' || error.property === 'updatedAt',
        );
        expect(dateErrors).toHaveLength(0);
      });

      it('should fail validation with invalid createdAt', async () => {
        (validUser as any).createdAt = 'invalid-date';
        const errors = await validate(validUser);
        const createdAtErrors = errors.filter(
          (error) => error.property === 'createdAt',
        );
        expect(createdAtErrors.length).toBeGreaterThan(0);
        expect(createdAtErrors[0]?.constraints?.isDate).toBeDefined();
      });

      it('should fail validation with invalid updatedAt', async () => {
        (validUser as any).updatedAt = 'invalid-date';
        const errors = await validate(validUser);
        const updatedAtErrors = errors.filter(
          (error) => error.property === 'updatedAt',
        );
        expect(updatedAtErrors.length).toBeGreaterThan(0);
        expect(updatedAtErrors[0]?.constraints?.isDate).toBeDefined();
      });
    });
  });

  describe('Complete validation', () => {
    it('should pass validation with all valid properties', async () => {
      const errors = await validate(validUser);
      expect(errors).toHaveLength(0);
    });

    it('should collect all validation errors for invalid entity', async () => {
      const invalidUser = new User();
      invalidUser.id = 'invalid-uuid';
      invalidUser.username = 'ab'; // too short
      invalidUser.email = 'invalid-email';
      invalidUser.password = '123'; // too short
      invalidUser.fullName = ''; // empty
      invalidUser.organizationId = 'invalid-uuid';
      (invalidUser as any).role = 'INVALID_ROLE';
      (invalidUser as any).createdAt = 'invalid-date';
      (invalidUser as any).updatedAt = 'invalid-date';

      const errors = await validate(invalidUser);
      expect(errors.length).toBeGreaterThan(0);

      const errorProperties = errors.map((error) => error.property);
      expect(errorProperties).toContain('id');
      expect(errorProperties).toContain('username');
      expect(errorProperties).toContain('email');
      expect(errorProperties).toContain('password');
      expect(errorProperties).toContain('fullName');
      expect(errorProperties).toContain('organizationId');
      expect(errorProperties).toContain('role');
      expect(errorProperties).toContain('createdAt');
      expect(errorProperties).toContain('updatedAt');
    });
  });

  describe('Edge cases', () => {
    it('should handle special characters in fullName', async () => {
      validUser.fullName = "John O'Connor-Smith Jr.";
      const errors = await validate(validUser);
      const fullNameErrors = errors.filter(
        (error) => error.property === 'fullName',
      );
      expect(fullNameErrors).toHaveLength(0);
    });

    it('should handle long valid inputs', async () => {
      validUser.username = 'a'.repeat(50);
      validUser.email = 'very.long.email.address@very.long.domain.example.com';
      validUser.password = 'a'.repeat(100);
      validUser.fullName = 'Very Long Full Name '.repeat(5);

      const errors = await validate(validUser);
      expect(errors).toHaveLength(0);
    });

    it('should handle boundary values for minimum lengths', async () => {
      validUser.username = 'abc'; // exactly 3 characters
      validUser.password = 'abcd1234'; // exactly 8 characters
      validUser.fullName = 'A'; // exactly 1 character

      const errors = await validate(validUser);
      expect(errors).toHaveLength(0);
    });
  });
});
