import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { supabase } from '../src/services/supabase.js';

async function verify() {
  console.log('--- 1. Checking Database Connectivity ---');
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    const count = await prisma.org.count();
    console.log('✓ Database connected successfully! Total Orgs in DB:', count);
  } catch (err: any) {
    console.error('✗ Database connection failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n--- 2. Checking Supabase Storage Connectivity ---');
  if (supabase) {
    try {
      const { data: buckets, error } = await supabase.storage.listBuckets();
      if (error) {
        console.error('✗ Supabase storage check failed:', error.message);
      } else {
        const bucketNames = buckets.map((b) => b.name);
        console.log('✓ Supabase Storage connected! Buckets found:', bucketNames.join(', '));
      }
    } catch (err: any) {
      console.error('✗ Supabase client exception:', err.message);
    }
  } else {
    console.warn('! Supabase client is in mock mode (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing).');
  }
}

verify();

