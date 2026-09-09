import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://kkltrgjszsuozlrnjrnb.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';

const outputDir = path.resolve(__dirname, '../public/IMAGES/items');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, {
      headers: {
        'User-Agent': 'CIHInnovationLab/1.0 (https://cih.com.ng; contact@cih.com.ng)'
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) {
          const u = new URL(url);
          redirectUrl = `${u.protocol}//${u.host}${redirectUrl}`;
        }
        return downloadBuffer(redirectUrl).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

// Clean item name for searching
function getSearchQuery(rawName) {
  let name = rawName
    .replace(/^\d+\s+/, '') // remove leading numbers like "2 solid State Relay" -> "solid State Relay"
    .replace(/\(.*\)/g, '') // remove parenthesized details
    .replace(/[-_]/g, ' ')
    .trim();
  
  if (name.toLowerCase() === 'rtyui') return null; // skip test junk
  if (name.toLowerCase().includes('we-do') || name.toLowerCase().includes('we do')) return 'LEGO Education WeDo 2.0';
  if (name.toLowerCase().includes('dht ii') || name.toLowerCase().includes('dht')) return 'DHT22 sensor module';
  if (name.toLowerCase().includes('tello drone')) return 'Ryze Tello drone';
  if (name.toLowerCase().includes('sodering iron')) return 'Soldering iron';
  if (name.toLowerCase().includes('tactie button')) return 'Tactile push button switch';
  if (name.toLowerCase().includes('peltier tool')) return 'Thermoelectric Peltier cooler module';
  if (name.toLowerCase().includes('prototype shield')) return 'Arduino prototype shield';
  if (name.toLowerCase().includes('castor wheel')) return 'Swivel caster wheel';
  if (name.toLowerCase().includes('vero-board')) return 'Stripboard veroboard electronics';
  if (name.toLowerCase().includes('imuto aa battery')) return 'AA rechargeable battery';
  if (name.toLowerCase().includes('amtech 12v battery charger')) return '12V smart battery charger';
  if (name.toLowerCase().includes('bambu lab a1 mini')) return 'Bambu Lab 3D printer';
  if (name.toLowerCase().includes('ender 3d printer')) return 'Creality Ender 3 3D printer';
  if (name.toLowerCase().includes('mbot')) return 'Makeblock mBot educational robot';
  if (name.toLowerCase().includes('oculus vr headset')) return 'Meta Quest Oculus VR headset';
  if (name.toLowerCase().includes('asuno hd')) return 'Wireless security battery camera';
  
  return name;
}

// Search online image via Wikimedia Commons
async function searchOnlineImage(term) {
  const query = encodeURIComponent(term);
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${query}&gsrlimit=6&prop=imageinfo&iiprop=url|mime&format=json`;

  return new Promise((resolve) => {
    https.get(url, {
      headers: {
        'User-Agent': 'CIHInnovationLab/1.0 (https://cih.com.ng; contact@cih.com.ng)'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const pages = json.query?.pages;
          if (!pages) return resolve(null);
          
          for (const k in pages) {
            const info = pages[k].imageinfo?.[0];
            if (info && info.url && (info.mime.startsWith('image/jpeg') || info.mime.startsWith('image/png') || info.mime.startsWith('image/webp'))) {
              const urlLower = info.url.toLowerCase();
              // Prefer images that aren't diagrams or maps
              if (!urlLower.endsWith('.svg') && !urlLower.includes('logo') && !urlLower.includes('map') && !urlLower.includes('chart')) {
                return resolve(info.url);
              }
            }
          }
          // Fallback to first
          for (const k in pages) {
            const info = pages[k].imageinfo?.[0];
            if (info && info.url) return resolve(info.url);
          }
          resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

// Fallback search using Wikipedia page images API
async function searchWikipediaImage(term) {
  const query = encodeURIComponent(term);
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&pithumbsize=800&generator=search&gsrsearch=${query}&gsrlimit=3`;

  return new Promise((resolve) => {
    https.get(url, {
      headers: {
        'User-Agent': 'CIHInnovationLab/1.0 (https://cih.com.ng; contact@cih.com.ng)'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const pages = json.query?.pages;
          if (!pages) return resolve(null);
          for (const k in pages) {
            const thumb = pages[k].thumbnail?.source;
            if (thumb) return resolve(thumb);
          }
          resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

// Convert image buffer to 600x600 WebP on pure white background
export async function convertToWhiteBgWebp(buffer, outputPath) {
  await sharp(buffer)
    .resize(600, 600, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .flatten({ background: '#FFFFFF' })
    .webp({ quality: 90 })
    .toFile(outputPath);
}

// Update Supabase item
async function updateSupabaseItem(id, imageUrl) {
  const url = `${SUPABASE_URL}/rest/v1/items?id=eq.${id}`;
  const body = JSON.stringify({ image_url: imageUrl });

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    }, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        resolve(true);
      } else {
        reject(new Error(`Failed to update item ${id}: HTTP ${res.statusCode}`));
      }
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Main process
export async function processItem(item) {
  const id = item.id;
  const name = item.item_name;
  if (!name) return null;

  const searchQuery = getSearchQuery(name);
  if (!searchQuery) {
    console.log(`[SKIP] No clean search query for "${name}"`);
    return null;
  }

  const slug = slugify(name);
  const outPath = path.join(outputDir, `${slug}.webp`);
  const publicUrl = `/IMAGES/items/${slug}.webp`;

  // If file already exists locally, just update database if needed
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) {
    if (item.image_url !== publicUrl) {
      await updateSupabaseItem(id, publicUrl);
      console.log(`[UPDATED DB] "${name}" -> ${publicUrl} (using existing file)`);
    }
    return publicUrl;
  }

  console.log(`[SEARCH] Searching image for "${name}" (query: "${searchQuery}")...`);
  let imgUrl = await searchOnlineImage(searchQuery);
  if (!imgUrl) {
    imgUrl = await searchWikipediaImage(searchQuery);
  }

  if (!imgUrl) {
    console.log(`[NOT FOUND] Could not find online image for "${name}"`);
    return null;
  }

  try {
    console.log(`[DOWNLOAD] Downloading ${imgUrl} for "${name}"...`);
    const buf = await downloadBuffer(imgUrl);
    
    console.log(`[SHARP] Formatting as WebP on white background...`);
    await convertToWhiteBgWebp(buf, outPath);

    console.log(`[SAVE] Updating Supabase item ${id}...`);
    await updateSupabaseItem(id, publicUrl);

    console.log(`[SUCCESS] "${name}" successfully updated with ${publicUrl}!`);
    return publicUrl;
  } catch (err) {
    console.error(`[ERROR] Processing "${name}":`, err.message);
    return null;
  }
}

async function run() {
  console.log('Fetching all items from Supabase...');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/items?select=id,item_name,image_url`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  const items = await res.json();
  console.log(`Found ${items.length} items in database.`);

  const toProcess = items.filter(i => !i.image_url || i.image_url.trim() === '');
  console.log(`${toProcess.length} items currently lack an image.`);

  for (let i = 0; i < toProcess.length; i++) {
    const item = toProcess[i];
    console.log(`\n(${i + 1}/${toProcess.length}) Processing "${item.item_name}"...`);
    await processItem(item);
    // Be polite with rate limits
    await new Promise(r => setTimeout(r, 600));
  }

  console.log('\nAll items processing complete!');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run();
}
