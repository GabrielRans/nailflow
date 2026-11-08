/**
 * Cliente Supabase - Instância única configurada para o NailFlow
 * Carregado via CDN ES Module (@supabase/supabase-js v2)
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Credenciais do projeto NailFlow (anon key - segura pois RLS protege os dados)
const SUPABASE_URL = 'https://hjpwukjsdavbahacumoq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_aXC_utHJE68MKG4jTdb3wQ_JgfDz-E-';

/**
 * Instância do cliente Supabase
 * @type {import('@supabase/supabase-js').SupabaseClient}
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Persistir sessão no localStorage do navegador
    storage: window.localStorage,
    // Detectar automaticamente sessão na URL (hash com tokens OAuth)
    detectSessionInUrl: true,
    // Auto-refresh do token antes de expirar
    autoRefreshToken: true,
  },
});

// Exporta também a URL/key para debug se necessário
export const SUPABASE_CONFIG = { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
