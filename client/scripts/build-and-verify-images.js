import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://kkltrgjszsuozlrnjrnb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XhJwMl5PFjt7uEoKqlMwxw_pXJ0vcur';

const publicDir = path.resolve(__dirname, '../public/IMAGES/items');
const distDir = path.resolve(__dirname, '../dist/IMAGES/items');

[publicDir, distDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function slugify(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

// Download buffer with redirect handling
function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, {
      headers: {
        'User-Agent': 'CIHInventory/1.0 (https://cih.com.ng; contact@cih.com.ng)'
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

// Resolve Wikimedia Commons "File:..." title to direct URL
async function resolveWikimediaTitle(title) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|mime&format=json`;
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'CIHInventory/1.0 (https://cih.com.ng; contact@cih.com.ng)'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const pages = json.query?.pages;
          for (const k in pages) {
            const info = pages[k].imageinfo?.[0];
            if (info && info.url) return resolve(info.url);
          }
          resolve(null);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
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
        reject(new Error(`Failed to update Supabase item ${id}: HTTP ${res.statusCode}`));
      }
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// 36 verified items to replace & upgrade
const TARGET_ITEMS = [
  {
    id: '7986fd71-f1e8-49bf-9ae3-ccd778aa15ee',
    name: 'Dual Shaft Gear Motor',
    localFile: '/home/olaewevictor01/.gemini/antigravity-ide/brain/dc2cecb5-110d-40ce-be00-80176efbd673/yellow_tt_gear_motor_1788816906278.jpg'
  },
  {
    id: '48e4e4ee-bc1e-45cd-991c-f9e2f012b24a',
    name: '2 solid State Relay',
    localFile: '/home/olaewevictor01/.gemini/antigravity-ide/brain/dc2cecb5-110d-40ce-be00-80176efbd673/solid_state_relay_module_1788816930419.jpg'
  },
  {
    id: 'd6ee9555-bd62-4eb1-806a-214b4149c9f1',
    name: 'Mr. Sketch',
    wikiTitle: 'File:Filzstifte1.jpg'
  },
  {
    id: '4b5538cf-3420-4a6a-b458-73c070e293d9',
    name: 'DHT II',
    wikiTitle: 'File:Dht11 term and humidity sensor.jpg'
  },
  {
    id: '4cc81f4d-7988-41f6-8d71-55807ff31dcf',
    name: '4 x 4 matrix keypad',
    wikiTitle: 'File:Keypad - 16 Button (Alphanumeric) (29221686437).jpg'
  },
  {
    id: 'dd0c1202-982b-44a5-9f12-b4931b68e578',
    name: 'Colour sensor light',
    wikiTitle: 'File:TCS3200Board.png'
  },
  {
    id: '07672ee1-6cd6-432f-b993-24b1ae45fd91',
    name: 'Ultrasonic sensor',
    wikiTitle: 'File:SparkFun HC-SR04 Ultrasonic-Sensor 13959-01a.jpg'
  },
  {
    id: '03d1edcb-a96a-4f5e-ac72-c4d4faa56158',
    name: 'RFID',
    wikiTitle: 'File:RFID-RC522 photo.jpg'
  },
  {
    id: '56cdb5b9-c729-4258-ba35-4c5e4da152f4',
    name: 'Vibration Module',
    wikiTitle: 'File:Digital Tilt Sensor Forceup 1480265 6 7 HDR Enhancer.jpg'
  },
  {
    id: '64523d58-efe8-4c8c-a34b-2083657cd127',
    name: 'MP3 SD Card',
    directUrl: 'https://raw.githubusercontent.com/enjoyneering/DFPlayer/main/images/DFPlayer_Mini_Modification.jpg'
  },
  {
    id: 'd6d3ba5b-8a3a-4d11-bbeb-36289e319e12',
    name: 'ESPS',
    wikiTitle: 'File:NodeMCU DEVKIT 1.0.jpg'
  },
  {
    id: '5a7c22e6-04b9-4610-a52e-2132d4b230b3',
    name: 'Wheels',
    localFile: '/home/olaewevictor01/.gemini/antigravity-ide/brain/dc2cecb5-110d-40ce-be00-80176efbd673/robot_smart_car_wheel_1788816886435.jpg'
  },
  {
    id: '6c2be95d-34b4-4d14-9314-23d0ebfdd4f8',
    name: 'Power Switch',
    wikiTitle: 'File:On-Off Switch.jpg'
  },
  {
    id: 'def4dc48-20ee-4dc7-801e-595703ce7634',
    name: 'Infra-red',
    wikiTitle: 'File:Line follower.jpg'
  },
  {
    id: 'd5b245f0-8413-4c12-81a4-ba9104571883',
    name: 'Tactie button',
    wikiTitle: 'File:Push button 1480301 2 3 HDR Enhancer.jpg'
  },
  {
    id: '1e917454-9457-473c-8299-ee0f9d2dacd5',
    name: 'Male header',
    wikiTitle: 'File:6 Pin Header.jpg'
  },
  {
    id: '927cbd5e-3bf7-4002-af4b-ee07cc74d764',
    name: 'Tactie button extras',
    wikiTitle: 'File:Tactile switches.jpg'
  },
  {
    id: '33e0d6ef-dcfc-4d42-8000-767d9eae0812',
    name: 'Water sensor',
    wikiTitle: 'File:SparkFun Weather Shield 13956-01.jpg'
  },
  {
    id: '9e43cfa1-d345-473e-8579-5b85e600349e',
    name: 'Motor driver board',
    wikiTitle: 'File:Dosmotorsl298n.jpg'
  },
  {
    id: '3a512dee-410f-473c-8116-ce133333bb28',
    name: 'RGB led module',
    wikiTitle: 'File:5mm LED Light-emitting diode three color 1480292 3 4 HDR Enhancer.jpg'
  },
  {
    id: '744af81b-1627-40d7-8d8f-76a037f85fd2',
    name: '8 x 8 Matrix',
    wikiTitle: 'File:MFrey 8x8 LED Matrix.JPG'
  },
  {
    id: 'f8f06c04-a9e1-4c43-837d-19147e4591bb',
    name: 'mBot Educational Robot Kit',
    wikiTitle: 'File:Mbot free to use creative commons.jpg'
  },
  {
    id: '697dc148-da34-48dd-b381-eba1f91f0688',
    name: 'madeblock',
    wikiTitle: 'File:Mbot percorso otto.png'
  },
  {
    id: '7bc4c918-6aa5-4df7-ac08-aa96273747c0',
    name: 'LCD',
    wikiTitle: 'File:HD44780.jpg'
  },
  {
    id: '91934703-b204-4929-b237-ff0e7271359c',
    name: 'PIR Motion Sensor',
    wikiTitle: 'File:PIR-inexpensive.jpg'
  },
  {
    id: '1392beb3-af36-4865-b2ad-9361b9cd52ff',
    name: 'Joystick',
    wikiTitle: 'File:SparkFun breakout-board-for-thumb-joystick 16096160437 o.jpg'
  },
  {
    id: 'b6187216-2840-4421-98c5-9d0ce31a588a',
    name: 'Charger Head (ASUS)',
    wikiTitle: 'File:Plug-in power adapter USB for Apple, Model A1300, by Flextronics-0813.jpg'
  },
  {
    id: '1860756b-7b81-47aa-aa2d-98473f5b7da7',
    name: 'DIY Scissors',
    wikiTitle: 'File:Small pair of blue scissors.jpg'
  },
  {
    id: '604f85e4-79e6-484d-87cb-fc6ba82e399c',
    name: '5 Meter VR Cable',
    wikiTitle: 'File:IKEA SITTBRUNN USB C TO C CABLE.jpg'
  },
  {
    id: '9a11d9e8-85d1-49ea-b665-ab680fcbc81c',
    name: 'Water Pump',
    wikiTitle: 'File:Tauchpumpe EDEN 104s 2007-10-14 aa EDIT CUT 1944x1944.jpg'
  },
  {
    id: '63b3c1ab-8ff7-4c50-bc48-82f7ccf12c71',
    name: 'Sensor Kit 2.0',
    wikiTitle: 'File:Assemblaggio laboratorio kit starter.jpg'
  },
  {
    id: 'afa65a2b-d0f1-4ee9-a5ee-dc292e5e99ca',
    name: 'amtech 12v battery charger',
    wikiTitle: 'File:Car-battery-recharger.jpg'
  },
  {
    id: '91558bef-fe5c-4d12-afbc-1972a7283058',
    name: '3D Printing bed',
    wikiTitle: 'File:3D printer working on green model parts.jpg'
  },
  {
    id: '1302ebd0-df3a-4505-aacf-57a23e899c53',
    name: '3d Glue Stick',
    wikiTitle: 'File:FABER-CASTELL glue stick.jpg'
  },
  {
    id: 'ae226a5f-44d6-4358-b0a8-65681fd18bba',
    name: 'Filament',
    wikiTitle: 'File:Universal stand-alone filament spool holder (Fully 3D-printable) v04.jpg'
  },
  {
    id: '5a3e3479-b67e-465f-9999-44f7b160c1e9',
    name: 'Tello Drone',
    wikiTitle: 'File:Ryze Tello.jpg'
  }
];

async function processTarget(item, index, total) {
  const slug = slugify(item.name);
  const outFilename = `${slug}.webp`;
  const publicOutPath = path.join(publicDir, outFilename);
  const distOutPath = path.join(distDir, outFilename);
  const publicUrl = `/IMAGES/items/${outFilename}`;

  console.log(`\n[${index + 1}/${total}] Processing "${item.name}"...`);

  let buffer;

  if (item.localFile) {
    console.log(`  Reading local file: ${item.localFile}`);
    buffer = fs.readFileSync(item.localFile);
  } else {
    let downloadUrl = item.directUrl;
    if (!downloadUrl && item.wikiTitle) {
      console.log(`  Resolving Wikimedia title: "${item.wikiTitle}"...`);
      downloadUrl = await resolveWikimediaTitle(item.wikiTitle);
    }

    if (!downloadUrl) {
      console.error(`  ❌ Failed to resolve download URL for "${item.name}"`);
      return false;
    }

    console.log(`  Downloading: ${downloadUrl}`);
    buffer = await downloadBuffer(downloadUrl);
  }

  console.log(`  Converting to 600x600 WebP with white background via Sharp...`);
  const webpBuffer = await sharp(buffer)
    .resize(600, 600, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .flatten({ background: '#FFFFFF' })
    .webp({ quality: 90 })
    .toBuffer();

  fs.writeFileSync(publicOutPath, webpBuffer);
  fs.writeFileSync(distOutPath, webpBuffer);
  console.log(`  Saved to ${publicOutPath} and ${distOutPath} (${(webpBuffer.length / 1024).toFixed(1)} KB)`);

  console.log(`  Updating Supabase item [${item.id}] with ${publicUrl}...`);
  await updateSupabaseItem(item.id, publicUrl);
  console.log(`  ✅ Successfully updated "${item.name}" in database!`);

  return true;
}

async function main() {
  console.log(`Starting update of ${TARGET_ITEMS.length} items with authentic DIY / maker images...`);
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < TARGET_ITEMS.length; i++) {
    try {
      const ok = await processTarget(TARGET_ITEMS[i], i, TARGET_ITEMS.length);
      if (ok) successCount++;
      else failCount++;
      // polite delay
      await new Promise(r => setTimeout(r, 400));
    } catch (err) {
      console.error(`  ❌ Error processing "${TARGET_ITEMS[i].name}":`, err.message);
      failCount++;
    }
  }

  console.log(`\n========================================`);
  console.log(`COMPLETED! Success: ${successCount} | Failed: ${failCount}`);
  console.log(`========================================`);
}

main();
