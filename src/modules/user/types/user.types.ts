/**
 * Interface for user data as stored in the database
 */
export interface IUser {
  id: string;
  username: string;
  email: string;
  password: string;
  fullName: string;
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
}

/**
 * Interface for user update data
 */
export interface IUpdateUser {
  username?: string;
  email?: string;
  fullName?: string;
}

/**
 * Interface for user query filters
 */
export interface IUserFilters {
  id?: string;
  username?: string;
  email?: string;
}

/**
 * Interface for user service methods
 */
export interface IUserService {
  create(userData: ICreateUser): Promise<IUser>;
  findByEmail(email: string): Promise<IUser | null>;
  findByUsername(username: string): Promise<IUser | null>;
  findById(id: string): Promise<IUser | null>;
  update(id: string, updateData: IUpdateUser): Promise<IUser>;
  delete(id: string): Promise<void>;
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
}
