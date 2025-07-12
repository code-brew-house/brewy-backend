import { IOrganization } from '../types/organization.types';

export class Organization implements IOrganization {
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

  constructor(data: IOrganization) {
    this.id = data.id;
    this.name = data.name;
    this.contactNumber = data.contactNumber;
    this.email = data.email;
    this.totalMemberCount = data.totalMemberCount;
    this.maxUsers = data.maxUsers;
    this.maxConcurrentJobs = data.maxConcurrentJobs;
    this.archivedAt = data.archivedAt;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}
