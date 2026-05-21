/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user: import('@supabase/supabase-js').User | null;
    profile: {
      id: string;
      full_name: string;
      email: string;
      role: string;
      created_at: string;
    } | null;
    entries: Array<{
      id: number;
      user_id: string;
      entry_number: number;
      display_name: string;
      status: 'pending' | 'approved' | 'rejected';
      payment_receipt_url: string | null;
      total_points: number;
      created_at: string;
    }>;
    isApproved: boolean;
  }
}
