import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { RegisterDto } from '../../modules/auth/dto/register.dto';
import { LoginDto } from '../../modules/auth/dto/login.dto';
import { CreateUserDto } from '../../modules/user/dto/create-user.dto';

describe('DTO Validation Integration Tests', () => {
  describe('RegisterDto', () => {
    it('should pass validation with valid data', async () => {
      const dto = plainToClass(RegisterDto, {
        username: 'john_doe123',
        email: 'john.doe@example.com',
        password: 'MyStr0ng!Pass',
        fullName: 'John Doe',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with weak password', async () => {
      const dto = plainToClass(RegisterDto, {
        username: 'john_doe123',
        email: 'john.doe@example.com',
        password: 'password123', // weak password - no uppercase, no special chars
        fullName: 'John Doe',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const passwordErrors = errors.find(
        (error) => error.property === 'password',
      );
      expect(passwordErrors).toBeDefined();
      expect(passwordErrors?.constraints?.matches).toContain(
        'Password must contain at least one uppercase letter',
      );
    });

    it('should fail validation with invalid username', async () => {
      const dto = plainToClass(RegisterDto, {
        username: 'us@er', // invalid character @
        email: 'john.doe@example.com',
        password: 'MyStr0ng!Pass',
        fullName: 'John Doe',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const usernameErrors = errors.find(
        (error) => error.property === 'username',
      );
      expect(usernameErrors).toBeDefined();
      expect(usernameErrors?.constraints?.matches).toContain(
        'Username can only contain letters, numbers, underscores, dots, and hyphens',
      );
    });

    it('should fail validation with dangerous content', async () => {
      const dto = plainToClass(RegisterDto, {
        username: 'john<script>alert(1)</script>doe',
        email: 'john.doe@example.com',
        password: 'MyStr0ng!Pass',
        fullName: 'John Doe',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const usernameErrors = errors.find(
        (error) => error.property === 'username',
      );
      expect(usernameErrors).toBeDefined();
      expect(usernameErrors?.constraints?.matches).toContain(
        'Username can only contain letters, numbers, underscores, dots, and hyphens',
      );
    });

    it('should fail validation with invalid email', async () => {
      const dto = plainToClass(RegisterDto, {
        username: 'john_doe123',
        email: 'user<script>@example.com', // dangerous email
        password: 'MyStr0ng!Pass',
        fullName: 'John Doe',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const emailErrors = errors.find((error) => error.property === 'email');
      expect(emailErrors).toBeDefined();
      expect(emailErrors?.constraints?.matches).toContain(
        'Email contains invalid characters',
      );
    });

    it('should fail validation with invalid full name', async () => {
      const dto = plainToClass(RegisterDto, {
        username: 'john_doe123',
        email: 'john.doe@example.com',
        password: 'MyStr0ng!Pass',
        fullName: 'John123 Doe', // invalid characters
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const fullNameErrors = errors.find(
        (error) => error.property === 'fullName',
      );
      expect(fullNameErrors).toBeDefined();
      expect(fullNameErrors?.constraints?.matches).toContain(
        'Full name can only contain letters, spaces, apostrophes, and hyphens',
      );
    });

    it('should transform and validate trimmed inputs', async () => {
      const dto = plainToClass(RegisterDto, {
        username: '  john_doe123  ',
        email: '  JOHN.DOE@EXAMPLE.COM  ',
        password: 'MyStr0ng!Pass',
        fullName: '  John Doe  ',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);

      // Check that transformation occurred
      expect(dto.username).toBe('john_doe123');
      expect(dto.email).toBe('john.doe@example.com');
      expect(dto.fullName).toBe('John Doe');
    });
  });

  describe('LoginDto', () => {
    it('should pass validation with valid data', async () => {
      const dto = plainToClass(LoginDto, {
        identifier: 'john.doe@example.com',
        password: 'MyStr0ng!Pass',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with empty identifier', async () => {
      const dto = plainToClass(LoginDto, {
        identifier: '',
        password: 'MyStr0ng!Pass',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const identifierErrors = errors.find(
        (error) => error.property === 'identifier',
      );
      expect(identifierErrors).toBeDefined();
      expect(identifierErrors?.constraints?.isNotEmpty).toBe(
        'Email or username is required',
      );
    });

    it('should fail validation with dangerous content in identifier', async () => {
      const dto = plainToClass(LoginDto, {
        identifier: 'user<script>alert(1)</script>@example.com',
        password: 'MyStr0ng!Pass',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const identifierErrors = errors.find(
        (error) => error.property === 'identifier',
      );
      expect(identifierErrors).toBeDefined();
      expect(identifierErrors?.constraints?.matches).toContain(
        'Email or username contains invalid characters',
      );
    });

    it('should fail validation with too long password', async () => {
      const dto = plainToClass(LoginDto, {
        identifier: 'john.doe@example.com',
        password: 'A'.repeat(129), // too long
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const passwordErrors = errors.find(
        (error) => error.property === 'password',
      );
      expect(passwordErrors).toBeDefined();
      expect(passwordErrors?.constraints?.maxLength).toBe(
        'Password is too long',
      );
    });

    it('should transform and validate trimmed identifier', async () => {
      const dto = plainToClass(LoginDto, {
        identifier: '  john.doe@example.com  ',
        password: 'MyStr0ng!Pass',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);

      // Check that transformation occurred
      expect(dto.identifier).toBe('john.doe@example.com');
    });
  });

  describe('CreateUserDto', () => {
    it('should pass validation with valid data', async () => {
      const dto = plainToClass(CreateUserDto, {
        username: 'jane_smith456',
        email: 'jane.smith@example.com',
        password: 'Another!Str0ng&Pass',
        fullName: 'Jane Smith',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with multiple errors', async () => {
      const dto = plainToClass(CreateUserDto, {
        username: '', // empty
        email: 'not-an-email', // invalid
        password: '123', // weak
        fullName: '', // empty
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(4); // One error for each field

      const properties = errors.map((error) => error.property);
      expect(properties).toContain('username');
      expect(properties).toContain('email');
      expect(properties).toContain('password');
      expect(properties).toContain('fullName');
    });

    it('should fail validation with username too long', async () => {
      const dto = plainToClass(CreateUserDto, {
        username: 'a'.repeat(31), // too long
        email: 'jane.smith@example.com',
        password: 'Another!Str0ng&Pass',
        fullName: 'Jane Smith',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const usernameErrors = errors.find(
        (error) => error.property === 'username',
      );
      expect(usernameErrors).toBeDefined();
      expect(usernameErrors?.constraints?.maxLength).toBe(
        'Username must not exceed 30 characters',
      );
    });

    it('should fail validation with email too long', async () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      const dto = plainToClass(CreateUserDto, {
        username: 'jane_smith456',
        email: longEmail,
        password: 'Another!Str0ng&Pass',
        fullName: 'Jane Smith',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const emailErrors = errors.find((error) => error.property === 'email');
      expect(emailErrors).toBeDefined();
      expect(emailErrors?.constraints?.maxLength).toBe(
        'Email address is too long',
      );
    });

    it('should handle complex validation scenarios', async () => {
      const dto = plainToClass(CreateUserDto, {
        username: '_username', // starts with special char
        email: 'user@example..com', // consecutive dots
        password: 'password123', // weak password (no uppercase, special char)
        fullName: ' SpaceName ', // starts/ends with spaces
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(4); // Each field should have validation errors

      // Check that specific validation rules are triggered
      const usernameErrors = errors.find(
        (error) => error.property === 'username',
      );
      expect(usernameErrors?.constraints?.matches).toContain(
        'Username cannot start with special characters',
      );

      const emailErrors = errors.find((error) => error.property === 'email');
      expect(emailErrors?.constraints?.isEmail).toContain(
        'Please provide a valid email address',
      );

      const passwordErrors = errors.find(
        (error) => error.property === 'password',
      );
      expect(passwordErrors?.constraints?.matches).toContain(
        'Password must contain at least one uppercase letter',
      );

      const fullNameErrors = errors.find(
        (error) => error.property === 'fullName',
      );
      expect(fullNameErrors?.constraints?.matches).toContain(
        'Full name cannot start or end with spaces',
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle null values', async () => {
      const dto = plainToClass(RegisterDto, {
        username: null,
        email: null,
        password: null,
        fullName: null,
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(4); // All fields should fail validation
    });

    it('should handle undefined values', async () => {
      const dto = plainToClass(RegisterDto, {
        username: undefined,
        email: undefined,
        password: undefined,
        fullName: undefined,
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(4); // All fields should fail validation
    });

    it('should handle non-string values', async () => {
      const dto = plainToClass(RegisterDto, {
        username: 123,
        email: {},
        password: [],
        fullName: true,
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(4); // All fields should fail string validation

      errors.forEach((error) => {
        expect(error.constraints?.isString).toContain('must be a string');
      });
    });
  });
});
