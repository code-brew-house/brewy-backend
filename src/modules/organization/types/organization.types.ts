export interface IOrganization {
  id: string;
  name: string;
  contactNumber: string;
  email: string;
  totalMemberCount: number;
  maxUsers: number;
  maxConcurrentJobs: number;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateOrganization {
  name: string;
  contactNumber: string;
  email: string;
  totalMemberCount?: number;
}

export interface IUpdateOrganization {
  name?: string;
  contactNumber?: string;
  email?: string;
  totalMemberCount?: number;
}

export interface IOrganizationService {
  create(data: ICreateOrganization): Promise<IOrganization>;
  findAll(): Promise<IOrganization[]>;
  findOne(id: string): Promise<IOrganization | null>;
  update(id: string, data: IUpdateOrganization): Promise<IOrganization>;
  remove(id: string): Promise<IOrganization>;
  incrementMemberCount(id: string): Promise<IOrganization>;
  decrementMemberCount(id: string): Promise<IOrganization>;
}
