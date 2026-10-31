import { Router } from 'express';
import { SignUpHRInputSchema, SignInInputSchema } from '@shortlistiq/shared';
import { validate } from '../../middleware/validate.js';
import { dbService } from '../../services/db.js';
import { requireAuth } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { orgRepository, profileRepository } from '../../repositories/index.js';

export const authRouter = Router();

// Sign up as HR
authRouter.post('/signup-hr', validate({ body: SignUpHRInputSchema }), async (req, res, next) => {
  try {
    const { email, fullName, organizationName } = req.body;

    const existingProfile = await dbService.getProfileByEmail(email);
    if (existingProfile) {
      throw new AppError(409, 'USER_ALREADY_EXISTS', 'An account with this email already exists.');
    }

    // When someone signs up as HR, create their organization
    const org = await dbService.createOrganization(organizationName);
    await orgRepository.create(organizationName, 60, org.id);

    // Create the HR profile linked to the org
    const profile = await dbService.createProfile({
      email,
      fullName,
      role: 'hr',
      orgId: org.id
    });
    await profileRepository.create({
      id: profile.id,
      orgId: org.id,
      fullName,
      role: 'hr'
    });

    const token = `mock-token:${profile.id}:${profile.email}`;

    res.status(201).json({
      success: true,
      data: {
        profile,
        organization: org,
        token
      }
    });
  } catch (error) {
    next(error);
  }
});

// Sign In
authRouter.post('/signin', validate({ body: SignInInputSchema }), async (req, res, next) => {
  try {
    const { email } = req.body;
    let profile = await dbService.getProfileByEmail(email);

    if (!profile) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    let org = null;
    if (profile.orgId) {
      org = await dbService.getOrganizationById(profile.orgId);
    }

    const token = `mock-token:${profile.id}:${profile.email}`;

    res.json({
      success: true,
      data: {
        profile,
        organization: org,
        token
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get Current User Profile
authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const profile = req.user!;
    let org = null;
    if (profile.orgId) {
      org = await dbService.getOrganizationById(profile.orgId);
    }

    res.json({
      success: true,
      data: {
        profile,
        organization: org
      }
    });
  } catch (error) {
    next(error);
  }
});

// OAuth Callback / Sync (Google, Azure, Supabase)
authRouter.post('/oauth-sync', async (req, res, next) => {
  try {
    const { id, email, fullName } = req.body;
    if (!email) {
      throw new AppError(400, 'EMAIL_REQUIRED', 'Email is required for OAuth synchronization.');
    }

    let profile = await dbService.getProfileByEmail(email);
    let org = null;

    if (!profile) {
      // Auto-create organization and HR profile for new Google OAuth user
      const name = fullName || email.split('@')[0];
      const orgName = `${name}'s Organization`;
      org = await dbService.createOrganization(orgName);
      await orgRepository.create(orgName, 60, org.id);

      profile = await dbService.createProfile({
        id: id || undefined,
        email,
        fullName: name,
        role: 'hr',
        orgId: org.id
      });
      await profileRepository.create({
        id: profile.id,
        orgId: org.id,
        fullName: profile.fullName,
        role: 'hr'
      });
    } else if (profile.orgId) {
      org = await dbService.getOrganizationById(profile.orgId);
    }

    const token = `mock-token:${profile.id}:${profile.email}`;

    res.json({
      success: true,
      data: {
        profile,
        organization: org,
        token
      }
    });
  } catch (error) {
    next(error);
  }
});

