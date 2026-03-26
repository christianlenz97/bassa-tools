/* ===== Supabase Client ===== */
var SUPABASE_URL = 'https://zwpuqelwjqjlgvgzpiiy.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cHVxZWx3anFqbGd2Z3pwaWl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NjcyODAsImV4cCI6MjA5MDA0MzI4MH0.NX30Vb8REXoDCSEUeDcsOTDnk6Ze-4fi2ncqh6R-f7Y';

var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ===== Auth Helpers ===== */
function sbLogin(email, password) {
  return supabase.auth.signInWithPassword({ email: email, password: password });
}

function sbLogout() {
  return supabase.auth.signOut();
}

function sbGetSession() {
  return supabase.auth.getSession();
}

function sbGetUser() {
  return supabase.auth.getUser();
}

function sbOnAuthChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

function sbUserId() {
  var s = supabase.auth.session && supabase.auth.session();
  if (s && s.user) return s.user.id;
  return null;
}

/* ===== Edge Function Helper ===== */
function sbCallFunction(name, body) {
  return supabase.functions.invoke(name, { body: body });
}

/* ===== Projects DB Helpers ===== */
function sbGetAllProjects() {
  return supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });
}

function sbGetProject(id) {
  return supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();
}

function sbUpsertProject(data) {
  return supabase
    .from('projects')
    .upsert(data, { onConflict: 'id' })
    .select()
    .single();
}

function sbInsertProject(data) {
  return supabase
    .from('projects')
    .insert(data)
    .select()
    .single();
}

function sbDeleteProject(id) {
  return supabase
    .from('projects')
    .delete()
    .eq('id', id);
}

/* ===== Fotodoku Settings Helpers ===== */
function sbGetFotodokuSettings(userId) {
  return supabase
    .from('fotodoku_settings')
    .select('*')
    .eq('user_id', userId)
    .single();
}

function sbUpsertFotodokuSettings(data) {
  return supabase
    .from('fotodoku_settings')
    .upsert(data, { onConflict: 'user_id' })
    .select()
    .single();
}

/* ===== Fotodoku Images DB Helpers ===== */
function sbGetFotodokuImages(userId) {
  return supabase
    .from('fotodoku_images')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true });
}

function sbInsertFotodokuImage(data) {
  return supabase
    .from('fotodoku_images')
    .insert(data)
    .select()
    .single();
}

function sbUpdateFotodokuImage(id, data) {
  return supabase
    .from('fotodoku_images')
    .update(data)
    .eq('id', id);
}

function sbDeleteFotodokuImage(id) {
  return supabase
    .from('fotodoku_images')
    .delete()
    .eq('id', id);
}

function sbDeleteAllFotodokuImages(userId) {
  return supabase
    .from('fotodoku_images')
    .delete()
    .eq('user_id', userId);
}

/* ===== Fotodoku Storage Helpers ===== */
function sbUploadImage(userId, fileName, blob) {
  var path = userId + '/' + Date.now() + '_' + fileName;
  return supabase.storage
    .from('fotodoku-images')
    .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false })
    .then(function(res) {
      if (res.error) return { error: res.error, path: null };
      return { error: null, path: res.data.path };
    });
}

function sbGetImageUrl(path) {
  var res = supabase.storage
    .from('fotodoku-images')
    .createSignedUrl(path, 3600);
  return res;
}

function sbDeleteStorageImage(path) {
  return supabase.storage
    .from('fotodoku-images')
    .remove([path]);
}

function sbDeleteAllStorageImages(userId) {
  return supabase.storage
    .from('fotodoku-images')
    .list(userId + '/')
    .then(function(res) {
      if (res.error || !res.data || !res.data.length) return;
      var paths = res.data.map(function(f) { return userId + '/' + f.name; });
      return supabase.storage.from('fotodoku-images').remove(paths);
    });
}
