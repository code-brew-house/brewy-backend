import { SanitizationUtil } from './sanitization.util';

describe('SanitizationUtil', () => {
  describe('sanitizeHtml', () => {
    it('should remove script tags', () => {
      const maliciousInput = '<script>alert("XSS")</script>Hello World';
      const result = SanitizationUtil.sanitizeHtml(maliciousInput);
      expect(result).toBe('Hello World');
    });

    it('should remove iframe tags', () => {
      const maliciousInput =
        '<iframe src="javascript:alert(1)"></iframe>Safe content';
      const result = SanitizationUtil.sanitizeHtml(maliciousInput);
      expect(result).toBe('Safe content');
    });

    it('should remove dangerous attributes', () => {
      const maliciousInput = '<div onclick="alert(1)">Click me</div>';
      const result = SanitizationUtil.sanitizeHtml(maliciousInput);
      expect(result).toBe('<div>Click me</div>');
    });

    it('should remove HTML comments', () => {
      const input = '<!-- This is a comment -->Hello World';
      const result = SanitizationUtil.sanitizeHtml(input);
      expect(result).toBe('Hello World');
    });

    it('should handle empty input', () => {
      const result = SanitizationUtil.sanitizeHtml('');
      expect(result).toBe('');
    });

    it('should handle null input', () => {
      const result = SanitizationUtil.sanitizeHtml(null as any);
      expect(result).toBe('');
    });

    it('should handle non-string input', () => {
      const result = SanitizationUtil.sanitizeHtml(123 as any);
      expect(result).toBe('');
    });

    it('should remove multiple dangerous tags', () => {
      const maliciousInput =
        '<script>alert(1)</script><iframe></iframe><object></object>Clean text';
      const result = SanitizationUtil.sanitizeHtml(maliciousInput);
      expect(result).toBe('Clean text');
    });
  });

  describe('sanitizeInput', () => {
    it('should encode HTML entities', () => {
      const input = '<div>Hello & "World"</div>';
      const result = SanitizationUtil.sanitizeInput(input);
      expect(result).toBe(
        '&lt;div&gt;Hello &amp; &quot;World&quot;&lt;&#x2F;div&gt;',
      );
    });

    it('should remove control characters', () => {
      const input = 'Hello\x00World\x1F';
      const result = SanitizationUtil.sanitizeInput(input);
      expect(result).toBe('HelloWorld');
    });

    it('should handle empty input', () => {
      const result = SanitizationUtil.sanitizeInput('');
      expect(result).toBe('');
    });

    it('should handle null input', () => {
      const result = SanitizationUtil.sanitizeInput(null as any);
      expect(result).toBe('');
    });

    it('should encode single quotes and forward slashes', () => {
      const input = "Hello 'World' and /path/to/file";
      const result = SanitizationUtil.sanitizeInput(input);
      expect(result).toBe(
        'Hello &#x27;World&#x27; and &#x2F;path&#x2F;to&#x2F;file',
      );
    });
  });

  describe('sanitizeSql', () => {
    it('should remove SQL injection patterns', () => {
      const maliciousInput = "'; DROP TABLE users; --";
      const result = SanitizationUtil.sanitizeSql(maliciousInput);
      expect(result).toBe("'  TABLE users");
    });

    it('should remove UNION statements', () => {
      const maliciousInput = '1 UNION SELECT * FROM users';
      const result = SanitizationUtil.sanitizeSql(maliciousInput);
      expect(result).toBe('1   * FROM users');
    });

    it('should remove OR conditions', () => {
      const maliciousInput = '1 OR 1=1';
      const result = SanitizationUtil.sanitizeSql(maliciousInput);
      expect(result).toBe('1');
    });

    it('should handle empty input', () => {
      const result = SanitizationUtil.sanitizeSql('');
      expect(result).toBe('');
    });

    it('should handle null input', () => {
      const result = SanitizationUtil.sanitizeSql(null as any);
      expect(result).toBe('');
    });

    it('should remove SQL comments', () => {
      const maliciousInput = 'SELECT * FROM users -- comment';
      const result = SanitizationUtil.sanitizeSql(maliciousInput);
      expect(result).toBe('* FROM users  comment');
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove directory traversal patterns', () => {
      const maliciousInput = '../../../etc/passwd';
      const result = SanitizationUtil.sanitizeFilename(maliciousInput);
      expect(result).toBe('etcpasswd');
    });

    it('should remove dangerous characters', () => {
      const maliciousInput = 'file<>:*?"|name.txt';
      const result = SanitizationUtil.sanitizeFilename(maliciousInput);
      expect(result).toBe('filename.txt');
    });

    it('should handle empty input', () => {
      const result = SanitizationUtil.sanitizeFilename('');
      expect(result).toBe('sanitized_file');
    });

    it('should handle null input', () => {
      const result = SanitizationUtil.sanitizeFilename(null as any);
      expect(result).toBe('sanitized_file');
    });

    it('should limit filename length', () => {
      const longFilename = 'a'.repeat(300);
      const result = SanitizationUtil.sanitizeFilename(longFilename);
      expect(result.length).toBe(255);
    });

    it('should handle control characters', () => {
      const maliciousInput = 'file\x00\x1Fname.txt';
      const result = SanitizationUtil.sanitizeFilename(maliciousInput);
      expect(result).toBe('filename.txt');
    });
  });

  describe('sanitizeUrl', () => {
    it('should allow valid HTTP URLs', () => {
      const validUrl = 'https://example.com/path';
      const result = SanitizationUtil.sanitizeUrl(validUrl);
      expect(result).toBe(validUrl);
    });

    it('should allow valid HTTPS URLs', () => {
      const validUrl = 'http://example.com/path';
      const result = SanitizationUtil.sanitizeUrl(validUrl);
      expect(result).toBe(validUrl);
    });

    it('should reject javascript URLs', () => {
      const maliciousUrl = 'javascript:alert(1)';
      const result = SanitizationUtil.sanitizeUrl(maliciousUrl);
      expect(result).toBe('');
    });

    it('should reject data URLs', () => {
      const maliciousUrl = 'data:text/html,<script>alert(1)</script>';
      const result = SanitizationUtil.sanitizeUrl(maliciousUrl);
      expect(result).toBe('');
    });

    it('should reject file URLs', () => {
      const maliciousUrl = 'file:///etc/passwd';
      const result = SanitizationUtil.sanitizeUrl(maliciousUrl);
      expect(result).toBe('');
    });

    it('should handle empty input', () => {
      const result = SanitizationUtil.sanitizeUrl('');
      expect(result).toBe('');
    });

    it('should handle null input', () => {
      const result = SanitizationUtil.sanitizeUrl(null as any);
      expect(result).toBe('');
    });

    it('should reject invalid URLs', () => {
      const invalidUrl = 'not-a-url';
      const result = SanitizationUtil.sanitizeUrl(invalidUrl);
      expect(result).toBe('');
    });

    it('should remove control characters', () => {
      const urlWithControlChars = 'https://example.com/path\x00\x1F';
      const result = SanitizationUtil.sanitizeUrl(urlWithControlChars);
      expect(result).toBe('https://example.com/path');
    });
  });

  describe('sanitizeEmail', () => {
    it('should allow valid email addresses', () => {
      const validEmail = 'user@example.com';
      const result = SanitizationUtil.sanitizeEmail(validEmail);
      expect(result).toBe(validEmail);
    });

    it('should convert to lowercase', () => {
      const email = 'USER@EXAMPLE.COM';
      const result = SanitizationUtil.sanitizeEmail(email);
      expect(result).toBe('user@example.com');
    });

    it('should reject invalid email addresses', () => {
      const invalidEmail = 'not-an-email';
      const result = SanitizationUtil.sanitizeEmail(invalidEmail);
      expect(result).toBe('');
    });

    it('should remove dangerous characters', () => {
      const maliciousEmail = 'user<script>@example.com';
      const result = SanitizationUtil.sanitizeEmail(maliciousEmail);
      expect(result).toBe('');
    });

    it('should handle empty input', () => {
      const result = SanitizationUtil.sanitizeEmail('');
      expect(result).toBe('');
    });

    it('should handle null input', () => {
      const result = SanitizationUtil.sanitizeEmail(null as any);
      expect(result).toBe('');
    });

    it('should remove control characters', () => {
      const emailWithControlChars = 'user\x00@example.com';
      const result = SanitizationUtil.sanitizeEmail(emailWithControlChars);
      expect(result).toBe('');
    });
  });

  describe('sanitizePhone', () => {
    it('should allow valid phone number characters', () => {
      const validPhone = '+1 (555) 123-4567';
      const result = SanitizationUtil.sanitizePhone(validPhone);
      expect(result).toBe('+1 (555) 123-4567');
    });

    it('should remove invalid characters', () => {
      const maliciousPhone = '+1<script>alert(1)</script>(555)123-4567';
      const result = SanitizationUtil.sanitizePhone(maliciousPhone);
      expect(result).toBe('+1(1)(555)123-4567');
    });

    it('should handle empty input', () => {
      const result = SanitizationUtil.sanitizePhone('');
      expect(result).toBe('');
    });

    it('should handle null input', () => {
      const result = SanitizationUtil.sanitizePhone(null as any);
      expect(result).toBe('');
    });

    it('should keep only allowed characters', () => {
      const phone = 'abc+1-555-123-4567xyz';
      const result = SanitizationUtil.sanitizePhone(phone);
      expect(result).toBe('+1-555-123-4567');
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize all string fields by default', () => {
      const obj = {
        name: '<script>alert(1)</script>John',
        age: 25,
        description: 'Hello & "World"',
      };
      const result = SanitizationUtil.sanitizeObject(obj);
      expect(result.name).toBe('John');
      expect(result.age).toBe(25);
      expect(result.description).toBe('Hello &amp; &quot;World&quot;');
    });

    it('should apply specific sanitization for email fields', () => {
      const obj = {
        email: 'USER@EXAMPLE.COM',
        name: 'John Doe',
      };
      const result = SanitizationUtil.sanitizeObject(obj, {
        emailFields: ['email'],
      });
      expect(result.email).toBe('user@example.com');
      expect(result.name).toBe('John Doe');
    });

    it('should apply specific sanitization for URL fields', () => {
      const obj = {
        website: 'https://example.com',
        profile: 'javascript:alert(1)',
      };
      const result = SanitizationUtil.sanitizeObject(obj, {
        urlFields: ['website', 'profile'],
      });
      expect(result.website).toBe('https://example.com');
      expect(result.profile).toBe('');
    });

    it('should apply specific sanitization for phone fields', () => {
      const obj = {
        phone: '+1<script>(555)123-4567',
        name: 'John Doe',
      };
      const result = SanitizationUtil.sanitizeObject(obj, {
        phoneFields: ['phone'],
      });
      expect(result.phone).toBe('+1(555)123-4567');
      expect(result.name).toBe('John Doe');
    });

    it('should apply specific sanitization for filename fields', () => {
      const obj = {
        filename: '../../../etc/passwd',
        title: 'Document Title',
      };
      const result = SanitizationUtil.sanitizeObject(obj, {
        filenameFields: ['filename'],
      });
      expect(result.filename).toBe('etcpasswd');
      expect(result.title).toBe('Document Title');
    });

    it('should handle null input', () => {
      const result = SanitizationUtil.sanitizeObject(null);
      expect(result).toBeNull();
    });

    it('should handle non-object input', () => {
      const result = SanitizationUtil.sanitizeObject('not an object');
      expect(result).toBe('not an object');
    });

    it('should apply HTML sanitization for HTML fields', () => {
      const obj = {
        content: '<script>alert(1)</script><p>Hello World</p>',
        title: 'Safe Title',
      };
      const result = SanitizationUtil.sanitizeObject(obj, {
        htmlFields: ['content'],
      });
      expect(result.content).toBe('<p>Hello World</p>');
      expect(result.title).toBe('Safe Title');
    });
  });
});
