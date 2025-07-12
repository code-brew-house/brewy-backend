/**
 * User roles within an organization
 */
export type UserRole = 'SUPER_OWNER' | 'OWNER' | 'ADMIN' | 'AGENT';

/**
 * Interface for user data as stored in the database
 */
export interface IUser {
  id: string;
  username: string;
  email: string;
  password: string;
  fullName: string;
  organizationId: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for user creation data
 */
export interface ICreateUser {
  username: string;
  email: string;
  password: string;
  fullName: string;
  organizationId: string;
  role: UserRole;
}

/**
 * Interface for user update data
 */
export interface IUpdateUser {
  username?: string;
  email?: string;
  fullName?: string;
  organizationId?: string;
  role?: UserRole;
}

/**
 * Interface for user query filters
 */
export interface IUserFilters {
  id?: string;
  username?: string;
  email?: string;
  organizationId?: string;
  role?: UserRole;
}

/**
 * Interface for user service methods
 */
export interface IUserService {
  create(userData: ICreateUser): Promise<IUser>;
  findByEmail(email: string): Promise<IUser | null>;
  findByUsername(username: string): Promise<IUser | null>;
  findById(id: string): Promise<IUser | null>;
  findByOrganization(organizationId: string): Promise<IUser[]>;
  update(id: string, updateData: IUpdateUser): Promise<IUser>;
  delete(id: string): Promise<void>;
  validateOrganizationAccess(
    userId: string,
    organizationId: string,
  ): Promise<boolean>;
  countByOrganization(organizationId: string): Promise<number>;
}

/**
 * Interface for user repository operations
 */
export interface IUserRepository {
  create(userData: ICreateUser): Promise<IUser>;
  findUnique(filters: IUserFilters): Promise<IUser | null>;
  findMany(filters?: IUserFilters): Promise<IUser[]>;
  update(id: string, updateData: IUpdateUser): Promise<IUser>;
  delete(id: string): Promise<void>;
  countByOrganization(organizationId: string): Promise<number>;
}
