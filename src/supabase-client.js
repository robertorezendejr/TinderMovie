/**
 * TinderMovie - Supabase Client
 * Inicialização compartilhada entre login.html e app.js
 */

const SUPABASE_URL = "https://zhgfkiwwkhnwsbwcauwh.supabase.co";
const SUPABASE_KEY = "sb_publishable_mimraK-A1WfPwu_nQEOVjQ_PATAqgLr";

const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
