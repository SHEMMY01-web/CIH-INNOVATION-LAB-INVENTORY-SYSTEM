import https from 'https';

const itemsToSearch = [
  { name: 'Dual Shaft Gear Motor', query: 'yellow TT DC gear motor dual shaft' },
  { name: '2 solid State Relay', query: 'solid state relay SSR-25DA' },
  { name: 'Mr. Sketch', query: 'felt tip markers colorful pens' },
  { name: 'DHT II', query: 'DHT11 sensor module' },
  { name: '4 x 4 matrix keypad', query: '4x4 matrix keypad Arduino' },
  { name: 'Colour sensor light', query: 'TCS3200 color sensor module' },
  { name: 'Ultrasonic sensor', query: 'HC-SR04 ultrasonic sensor' },
  { name: 'RFID', query: 'RC522 RFID module Arduino' },
  { name: 'Vibration Module', query: 'SW-420 vibration sensor module' },
  { name: 'MP3 SD Card', query: 'DFPlayer Mini MP3' },
  { name: 'ESPS', query: 'NodeMCU ESP8266 development board' },
  { name: 'Wheels', query: 'robot smart car wheel TT motor' },
  { name: 'Power Switch', query: 'rocker switch electronics' },
  { name: 'Infra-red', query: 'infrared obstacle avoidance sensor Arduino' },
  { name: 'Tactie button', query: 'tactile push button switch' },
  { name: 'Male header', query: 'male pin header strip 2.54mm' },
  { name: 'Tactie button extras', query: 'tactile button switch colorful caps' },
  { name: 'Water sensor', query: 'water level sensor module Arduino' },
  { name: 'Motor driver board', query: 'L298N motor driver module' },
  { name: 'RGB led module', query: 'RGB LED module Arduino KY-016' },
  { name: '8 x 8 Matrix', query: 'MAX7219 8x8 LED matrix module' },
  { name: 'mBot Educational Robot Kit', query: 'Makeblock mBot robot' },
  { name: 'madeblock', query: 'Makeblock robot kit parts' },
  { name: 'LCD', query: '1602 LCD module Arduino' },
  { name: 'PIR Motion Sensor', query: 'HC-SR501 PIR motion sensor' },
  { name: 'Joystick', query: 'analog joystick module Arduino' },
  { name: 'Charger Head (ASUS)', query: 'USB charger power adapter plug' },
  { name: 'DIY Scissors', query: 'craft scissors stainless steel' },
  { name: '5 Meter VR Cable', query: 'USB C cable black' },
  { name: 'Water Pump', query: 'mini DC submersible water pump' },
  { name: 'Sensor Kit 2.0', query: 'sensor kit Arduino 37 in 1' },
  { name: 'amtech 12v battery charger', query: '12V car battery charger' },
  { name: '3D Printing bed', query: '3D printer PEI sheet heated bed' },
  { name: '3d Glue Stick', query: 'glue stick' },
  { name: 'Filament', query: 'PLA 3D printer filament spool' },
  { name: 'Tello Drone', query: 'Ryze DJI Tello drone' }
];

async function searchWikimedia(term) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(term)}&gsrlimit=3&prop=imageinfo&iiprop=url|mime&format=json`;
  return new Promise((resolve) => {
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
          if (!pages) return resolve([]);
          const results = [];
          for (const k in pages) {
            const title = pages[k].title;
            const info = pages[k].imageinfo?.[0];
            if (info && info.url && (info.mime.startsWith('image/jpeg') || info.mime.startsWith('image/png'))) {
              results.push({ title, url: info.url });
            }
          }
          resolve(results);
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
}

async function main() {
  for (const item of itemsToSearch) {
    const res = await searchWikimedia(item.query);
    console.log(`\n=== ${item.name} (query: "${item.query}") ===`);
    if (res.length > 0) {
      res.forEach(r => console.log(`  - ${r.title}: ${r.url}`));
    } else {
      console.log('  ❌ NO RESULTS');
    }
    await new Promise(r => setTimeout(r, 200));
  }
}

main();
