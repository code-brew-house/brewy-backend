import { Organization } from './organization.entity';
import { IOrganization } from '../types/organization.types';

describe('Organization Entity', () => {
  let organization: Organization;
  const validOrganizationData: IOrganization = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Organization',
    contactNumber: '+1234567890',
    email: 'contact@testorg.com',
    totalMemberCount: 5,
    maxUsers: 100,
    maxConcurrentJobs: 10,
    archivedAt: null,
    createdAt: new Date('2023-01-01T00:00:00Z'),
    updatedAt: new Date('2023-01-02T00:00:00Z'),
  };

  describe('Entity Instantiation', () => {
    it('should create an instance of Organization with constructor', () => {
      organization = new Organization(validOrganizationData);
      expect(organization).toBeInstanceOf(Organization);
    });

    it('should properly initialize all properties from constructor data', () => {
      organization = new Organization(validOrganizationData);

      expect(organization.id).toBe(validOrganizationData.id);
      expect(organization.name).toBe(validOrganizationData.name);
      expect(organization.contactNumber).toBe(
        validOrganizationData.contactNumber,
      );
      expect(organization.email).toBe(validOrganizationData.email);
      expect(organization.totalMemberCount).toBe(
        validOrganizationData.totalMemberCount,
      );
      expect(organization.maxUsers).toBe(validOrganizationData.maxUsers);
      expect(organization.maxConcurrentJobs).toBe(
        validOrganizationData.maxConcurrentJobs,
      );
      expect(organization.archivedAt).toBe(validOrganizationData.archivedAt);
      expect(organization.createdAt).toBe(validOrganizationData.createdAt);
      expect(organization.updatedAt).toBe(validOrganizationData.updatedAt);
    });

    it('should implement IOrganization interface', () => {
      organization = new Organization(validOrganizationData);

      // Type check - this would fail at compile time if interface is not implemented
      const orgInterface: IOrganization = organization;
      expect(orgInterface).toBeDefined();
    });
  });

  describe('Constructor Behavior', () => {
    it('should handle null archivedAt correctly', () => {
      const dataWithNullArchived = {
        ...validOrganizationData,
        archivedAt: null,
      };
      organization = new Organization(dataWithNullArchived);

      expect(organization.archivedAt).toBeNull();
    });

    it('should handle non-null archivedAt correctly', () => {
      const archivedDate = new Date('2023-06-01T00:00:00Z');
      const dataWithArchivedDate = {
        ...validOrganizationData,
        archivedAt: archivedDate,
      };
      organization = new Organization(dataWithArchivedDate);

      expect(organization.archivedAt).toBe(archivedDate);
    });

    it('should correctly assign numeric properties', () => {
      const numericData = {
        ...validOrganizationData,
        totalMemberCount: 0,
        maxUsers: 1,
        maxConcurrentJobs: 1,
      };
      organization = new Organization(numericData);

      expect(organization.totalMemberCount).toBe(0);
      expect(organization.maxUsers).toBe(1);
      expect(organization.maxConcurrentJobs).toBe(1);
    });

    it('should correctly assign string properties', () => {
      const stringData = {
        ...validOrganizationData,
        name: 'A',
        contactNumber: '1',
        email: 'a@b.c',
      };
      organization = new Organization(stringData);

      expect(organization.name).toBe('A');
      expect(organization.contactNumber).toBe('1');
      expect(organization.email).toBe('a@b.c');
    });

    it('should correctly assign date properties', () => {
      const date1 = new Date('2020-01-01T00:00:00Z');
      const date2 = new Date('2020-12-31T23:59:59Z');
      const dateData = {
        ...validOrganizationData,
        createdAt: date1,
        updatedAt: date2,
      };
      organization = new Organization(dateData);

      expect(organization.createdAt).toBe(date1);
      expect(organization.updatedAt).toBe(date2);
    });
  });

  describe('Property Types and Values', () => {
    beforeEach(() => {
      organization = new Organization(validOrganizationData);
    });

    it('should have string type properties', () => {
      expect(typeof organization.id).toBe('string');
      expect(typeof organization.name).toBe('string');
      expect(typeof organization.contactNumber).toBe('string');
      expect(typeof organization.email).toBe('string');
    });

    it('should have number type properties', () => {
      expect(typeof organization.totalMemberCount).toBe('number');
      expect(typeof organization.maxUsers).toBe('number');
      expect(typeof organization.maxConcurrentJobs).toBe('number');
    });

    it('should have Date type properties', () => {
      expect(organization.createdAt).toBeInstanceOf(Date);
      expect(organization.updatedAt).toBeInstanceOf(Date);
    });

    it('should allow null for archivedAt property', () => {
      expect(organization.archivedAt).toBeNull();

      const archivedOrg = new Organization({
        ...validOrganizationData,
        archivedAt: new Date(),
      });
      expect(archivedOrg.archivedAt).toBeInstanceOf(Date);
    });

    it('should handle integer values for numeric properties', () => {
      const integerData = {
        ...validOrganizationData,
        totalMemberCount: 42,
        maxUsers: 1000,
        maxConcurrentJobs: 50,
      };
      organization = new Organization(integerData);

      expect(Number.isInteger(organization.totalMemberCount)).toBe(true);
      expect(Number.isInteger(organization.maxUsers)).toBe(true);
      expect(Number.isInteger(organization.maxConcurrentJobs)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings for string properties', () => {
      const emptyStringData = {
        ...validOrganizationData,
        name: '',
        contactNumber: '',
        email: '',
      };
      organization = new Organization(emptyStringData);

      expect(organization.name).toBe('');
      expect(organization.contactNumber).toBe('');
      expect(organization.email).toBe('');
    });

    it('should handle zero values for numeric properties', () => {
      const zeroData = {
        ...validOrganizationData,
        totalMemberCount: 0,
        maxUsers: 0,
        maxConcurrentJobs: 0,
      };
      organization = new Organization(zeroData);

      expect(organization.totalMemberCount).toBe(0);
      expect(organization.maxUsers).toBe(0);
      expect(organization.maxConcurrentJobs).toBe(0);
    });

    it('should handle negative values for numeric properties', () => {
      const negativeData = {
        ...validOrganizationData,
        totalMemberCount: -1,
        maxUsers: -100,
        maxConcurrentJobs: -10,
      };
      organization = new Organization(negativeData);

      expect(organization.totalMemberCount).toBe(-1);
      expect(organization.maxUsers).toBe(-100);
      expect(organization.maxConcurrentJobs).toBe(-10);
    });

    it('should handle large numeric values', () => {
      const largeData = {
        ...validOrganizationData,
        totalMemberCount: Number.MAX_SAFE_INTEGER,
        maxUsers: 999999999,
        maxConcurrentJobs: 888888888,
      };
      organization = new Organization(largeData);

      expect(organization.totalMemberCount).toBe(Number.MAX_SAFE_INTEGER);
      expect(organization.maxUsers).toBe(999999999);
      expect(organization.maxConcurrentJobs).toBe(888888888);
    });

    it('should handle very old and future dates', () => {
      const extremeDateData = {
        ...validOrganizationData,
        createdAt: new Date('1900-01-01T00:00:00Z'),
        updatedAt: new Date('2100-12-31T23:59:59Z'),
        archivedAt: new Date('2050-06-15T12:30:00Z'),
      };
      organization = new Organization(extremeDateData);

      expect(organization.createdAt.getFullYear()).toBe(1900);
      expect(organization.updatedAt.getFullYear()).toBe(2100);
      expect(organization.archivedAt?.getFullYear()).toBe(2050);
    });

    it('should handle long string values', () => {
      const longStringData = {
        ...validOrganizationData,
        name: 'A'.repeat(1000),
        contactNumber: '1'.repeat(100),
        email: 'a'.repeat(50) + '@' + 'b'.repeat(50) + '.com',
      };
      organization = new Organization(longStringData);

      expect(organization.name.length).toBe(1000);
      expect(organization.contactNumber.length).toBe(100);
      expect(organization.email.length).toBe(105); // 50 + 1 + 50 + 4
    });

    it('should create new instance with same data but different object reference', () => {
      const org1 = new Organization(validOrganizationData);
      const org2 = new Organization(validOrganizationData);

      expect(org1).not.toBe(org2); // Different object references
      expect(org1.id).toBe(org2.id); // But same data
      expect(org1.name).toBe(org2.name);
      expect(org1.email).toBe(org2.email);
    });

    it('should handle data mutation after construction', () => {
      organization = new Organization(validOrganizationData);
      const originalName = organization.name;

      // Mutate the property
      organization.name = 'Modified Organization Name';

      expect(organization.name).toBe('Modified Organization Name');
      expect(organization.name).not.toBe(originalName);
    });
  });

  describe('Data Integrity', () => {
    it('should maintain data integrity with partial data updates', () => {
      organization = new Organization(validOrganizationData);

      // Update only some properties
      organization.name = 'Updated Name';
      organization.maxUsers = 200;

      // Other properties should remain unchanged
      expect(organization.id).toBe(validOrganizationData.id);
      expect(organization.contactNumber).toBe(
        validOrganizationData.contactNumber,
      );
      expect(organization.email).toBe(validOrganizationData.email);
      expect(organization.totalMemberCount).toBe(
        validOrganizationData.totalMemberCount,
      );
      expect(organization.maxConcurrentJobs).toBe(
        validOrganizationData.maxConcurrentJobs,
      );
      expect(organization.archivedAt).toBe(validOrganizationData.archivedAt);
      expect(organization.createdAt).toBe(validOrganizationData.createdAt);
      expect(organization.updatedAt).toBe(validOrganizationData.updatedAt);

      // Updated properties should have new values
      expect(organization.name).toBe('Updated Name');
      expect(organization.maxUsers).toBe(200);
    });

    it('should not affect original data object after construction', () => {
      const originalData = { ...validOrganizationData };
      organization = new Organization(validOrganizationData);

      // Modify the organization instance
      organization.name = 'Modified Name';
      organization.maxUsers = 500;

      // Original data should remain unchanged
      expect(validOrganizationData.name).toBe(originalData.name);
      expect(validOrganizationData.maxUsers).toBe(originalData.maxUsers);
    });
  });
});
