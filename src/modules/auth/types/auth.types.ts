/**
 * Interface for JWT payload
 */
export interface JwtPayload {
  /** User ID */
  sub: string;

  /** Username */
  username: string;

  /** Email address */
  email: string;

  /** Organization ID */
  organizationId: string;

  /** User role within organization */
  role: 'SUPER_OWNER' | 'OWNER' | 'ADMIN' | 'AGENT';

  /** Token issued at timestamp */
  iat?: number;

  /** Token expiration timestamp */
  exp?: number;
}

/**
 * Interface for login credentials
 */
export interface ILoginCredentials {
  identifier: string; // email or username
  password: string;
}

/**
 * Interface for registration data
 */
export interface IRegisterData {
  username: string;
  email: string;
  password: string;
  fullName: string;
}

/**
 * Interface for authentication result
 */
export interface IAuthResult {
  accessToken: string;
  expiresIn: number;
  user: {
    id: string;
    username: string;
    email: string;
    fullName: string;
    createdAt: Date;
    updatedAt: Date;
  };
}

/**
 * Interface for authentication service methods
 */
export interface IAuthService {
  register(registerData: IRegisterData): Promise<IAuthResult>;
  login(credentials: ILoginCredentials): Promise<IAuthResult>;
  logout(userId: string): Promise<void>;
  validateUser(payload: JwtPayload): Promise<any>;
  generateToken(payload: JwtPayload): Promise<string>;
}

/**
 * Interface for token validation result
 */
export interface ITokenValidation {
  valid: boolean;
  payload?: JwtPayload;
  error?: string;
}
