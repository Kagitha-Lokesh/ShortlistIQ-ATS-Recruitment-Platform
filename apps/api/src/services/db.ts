import { Profile, Organization } from '@shortlistiq/shared';
import { v4 as uuidv4 } from 'uuid';

// In-memory fallback store for development/testing without live database
interface MockDataStore {
  organizations: Map<string, Organization>;
  profiles: Map<string, Profile>;
}

const mockStore: MockDataStore = {
  organizations: new Map(),
  profiles: new Map()
};

export const dbService = {
  async createOrganization(name: string): Promise<Organization> {
    const org: Organization = {
      id: uuidv4(),
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mockStore.organizations.set(org.id, org);
    return org;
  },

  async getOrganizationById(id: string): Promise<Organization | null> {
    return mockStore.organizations.get(id) || null;
  },

  async createProfile(data: {
    id?: string;
    email: string;
    fullName: string;
    role: 'hr' | 'candidate';
    orgId?: string | null;
  }): Promise<Profile> {
    const profile: Profile = {
      id: data.id || uuidv4(),
      email: data.email.toLowerCase(),
      fullName: data.fullName,
      role: data.role,
      orgId: data.orgId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mockStore.profiles.set(profile.id, profile);
    return profile;
  },

  async getProfileById(id: string): Promise<Profile | null> {
    return mockStore.profiles.get(id) || null;
  },

  async getProfileByEmail(email: string): Promise<Profile | null> {
    const normalized = email.toLowerCase();
    for (const profile of mockStore.profiles.values()) {
      if (profile.email === normalized) {
        return profile;
      }
    }
    return null;
  },

  async checkHealth(): Promise<boolean> {
    return true;
  },

  // Reset store for testing
  resetMockStore() {
    mockStore.organizations.clear();
    mockStore.profiles.clear();
  }
};

