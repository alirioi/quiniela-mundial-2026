import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import postgres from 'postgres'; // Actually, let's see if postgres is in package.json

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
