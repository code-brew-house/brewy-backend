import { Injectable } from '@nestjs/common';

/**
 * Utility class for input sanitization to prevent XSS attacks
 * and other security vulnerabilities
 */
@Injectable()
export class SanitizationUtil {
  /**
   * Sanitizes HTML content by removing dangerous tags and attributes
   * @param input - The input string to sanitize
   * @returns Sanitized string with dangerous HTML removed
   */
  static sanitizeHtml(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Remove script tags and their content
    input = input.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

    // Remove dangerous HTML tags
    const dangerousTags = [
      'script',
      'iframe',
      'object',
      'embed',
      'form',
      'input',
      'button',
      'textarea',
      'select',
      'option',
      'link',
      'meta',
      'style',
      'base',
      'applet',
      'body',
      'html',
      'head',
      'title',
      'frame',
      'frameset',
      'noframes',
      'noscript',
      'xml',
    ];

    dangerousTags.forEach((tag) => {
      const regex = new RegExp(`<\\/?${tag}[^>]*>`, 'gi');
      input = input.replace(regex, '');
    });

    // Remove dangerous attributes
    const dangerousAttributes = [
      'onload',
      'onerror',
      'onclick',
      'onmouseover',
      'onmouseout',
      'onmousedown',
      'onmouseup',
      'onkeydown',
      'onkeyup',
      'onkeypress',
      'onfocus',
      'onblur',
      'onchange',
      'onsubmit',
      'onreset',
      'onselect',
      'onabort',
      'oncancel',
      'onclose',
      'oncopy',
      'oncut',
      'ondrag',
      'ondragend',
      'ondragenter',
      'ondragleave',
      'ondragover',
      'ondragstart',
      'ondrop',
      'oninput',
      'oninvalid',
      'onpaste',
      'onscroll',
      'onsearch',
      'onwheel',
      'javascript:',
      'vbscript:',
      'data:',
      'src',
      'href',
    ];

    dangerousAttributes.forEach((attr) => {
      const regex = new RegExp(`\\s*${attr}\\s*=\\s*[^>]*`, 'gi');
      input = input.replace(regex, '');
    });

    // Remove HTML comments
    input = input.replace(/<!--[\s\S]*?-->/g, '');

    // Remove CDATA sections
    input = input.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');

    return input.trim();
  }

  /**
   * Sanitizes user input for safe storage and display
   * @param input - The input string to sanitize
   * @returns Sanitized string safe for storage and display
   */
  static sanitizeInput(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // First sanitize HTML
    let sanitized = this.sanitizeHtml(input);

    // Encode remaining HTML entities
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');

    // Remove null bytes and other control characters
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return sanitized.trim();
  }

  /**
   * Sanitizes SQL input to prevent SQL injection
   * Note: This is a basic sanitization. Always use parameterized queries
   * @param input - The input string to sanitize
   * @returns Sanitized string with SQL injection patterns removed
   */
  static sanitizeSql(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Remove SQL injection patterns
    const sqlPatterns = [
      /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b/gi,
      /\b(OR|AND)\s+\d+\s*=\s*\d+/gi,
      /\b(OR|AND)\s+\w+\s*=\s*\w+/gi,
      /(--|#|\/\*|\*\/)/g,
      /\bxp_\w+/gi,
      /\bsp_\w+/gi,
      /\bDECLARE\b/gi,
      /\bCAST\b/gi,
      /\bCONVERT\b/gi,
      /\bCHAR\b/gi,
      /\bNULL\b/gi,
      /\bWAITFOR\b/gi,
      /(;|\|)/g,
    ];

    let sanitized = input;
    sqlPatterns.forEach((pattern) => {
      sanitized = sanitized.replace(pattern, '');
    });

    return sanitized.trim();
  }

  /**
   * Sanitizes filename to prevent directory traversal attacks
   * @param filename - The filename to sanitize
   * @returns Sanitized filename safe for file operations
   */
  static sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      return 'sanitized_file';
    }

    // Remove directory traversal patterns
    let sanitized = filename
      .replace(/\.\./g, '')
      .replace(/\//g, '')
      .replace(/\\/g, '')
      .replace(/:/g, '')
      .replace(/\*/g, '')
      .replace(/\?/g, '')
      .replace(/"/g, '')
      .replace(/</g, '')
      .replace(/>/g, '')
      .replace(/\|/g, '');

    // Remove control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

    // Limit length and ensure it's not empty
    sanitized = sanitized.trim().substring(0, 255);

    if (!sanitized) {
      return 'sanitized_file';
    }

    return sanitized;
  }

  /**
   * Sanitizes URL to prevent malicious redirects
   * @param url - The URL to sanitize
   * @returns Sanitized URL or empty string if invalid
   */
  static sanitizeUrl(url: string): string {
    if (!url || typeof url !== 'string') {
      return '';
    }

    // Remove dangerous protocols
    const dangerousProtocols = [
      'javascript:',
      'vbscript:',
      'data:',
      'file:',
      'ftp:',
      'jar:',
      'mailto:',
      'news:',
      'gopher:',
      'ldap:',
      'feed:',
      'urn:',
      'tel:',
      'sms:',
      'callto:',
    ];

    const lowerUrl = url.toLowerCase();
    for (const protocol of dangerousProtocols) {
      if (lowerUrl.startsWith(protocol)) {
        return '';
      }
    }

    // Only allow http and https
    if (!lowerUrl.startsWith('http://') && !lowerUrl.startsWith('https://')) {
      return '';
    }

    // Remove HTML encoding
    let sanitized = url.replace(/&[a-zA-Z0-9#]+;/g, '');

    // Remove control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

    // Basic URL validation
    try {
      new URL(sanitized);
      return sanitized;
    } catch {
      return '';
    }
  }

  /**
   * Sanitizes email address
   * @param email - The email address to sanitize
   * @returns Sanitized email address or empty string if invalid
   */
  static sanitizeEmail(email: string): string {
    if (!email || typeof email !== 'string') {
      return '';
    }

    // Check for dangerous characters first
    if (/[<>;"'()]/.test(email)) {
      return '';
    }

    // Remove control characters
    const sanitized = email.replace(/[\x00-\x1F\x7F]/g, '');

    // If control characters were found, reject the email
    if (sanitized !== email) {
      return '';
    }

    // Basic email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(sanitized)) {
      return '';
    }

    return sanitized.trim().toLowerCase();
  }

  /**
   * Sanitizes phone number
   * @param phone - The phone number to sanitize
   * @returns Sanitized phone number with only digits, spaces, +, -, (, )
   */
  static sanitizePhone(phone: string): string {
    if (!phone || typeof phone !== 'string') {
      return '';
    }

    // Keep only digits and common phone characters
    const sanitized = phone.replace(/[^\d\s\+\-\(\)]/g, '');

    return sanitized.trim();
  }

  /**
   * Sanitizes object by applying appropriate sanitization to each field
   * @param obj - The object to sanitize
   * @param options - Sanitization options for specific fields
   * @returns Sanitized object
   */
  static sanitizeObject(
    obj: any,
    options: {
      htmlFields?: string[];
      emailFields?: string[];
      urlFields?: string[];
      phoneFields?: string[];
      filenameFields?: string[];
    } = {},
  ): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const sanitized = { ...obj };

    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'string') {
        if (options.htmlFields?.includes(key)) {
          sanitized[key] = this.sanitizeHtml(value);
        } else if (options.emailFields?.includes(key)) {
          sanitized[key] = this.sanitizeEmail(value);
        } else if (options.urlFields?.includes(key)) {
          sanitized[key] = this.sanitizeUrl(value);
        } else if (options.phoneFields?.includes(key)) {
          sanitized[key] = this.sanitizePhone(value);
        } else if (options.filenameFields?.includes(key)) {
          sanitized[key] = this.sanitizeFilename(value);
        } else {
          sanitized[key] = this.sanitizeInput(value);
        }
      }
    }

    return sanitized;
  }
}
