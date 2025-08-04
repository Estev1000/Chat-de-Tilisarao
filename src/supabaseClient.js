import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xzqlatpbhcqiortutwkt.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cWxhdHBiaGNxaW9ydHV0d2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxNTY5OTcsImV4cCI6MjA2OTczMjk5N30.ojEtVoM-tBZ5MdXTmAOJKR9Rx6A2ZoX6h-6dgNPAAHc';

export const supabase = createClient(supabaseUrl, supabaseKey);
