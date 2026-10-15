/**
 * Script kiểm tra tự động Upload ảnh lên Cloudinary qua API Pet Clinic Backend
 * Chạy lệnh: node scripts/test-cloudinary-live.js
 */

const https = require('https');
const http = require('http');

const BACKEND_URL = process.env.TEST_BACKEND_URL || 'https://pet-clinic-backend-a4lj.onrender.com';

function login(client, urlObj) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      identifier: 'admin@petclinic.com',
      password: 'Admin@1234'
    });

    const req = client.request({
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json.accessToken || json.data?.tokens?.accessToken);
          } else {
            reject(new Error(`Login failed (${res.statusCode}): ${body}`));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}, body: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function uploadImage(client, urlObj, token) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    
    // Sample 1x1 PNG image
    const samplePng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );

    const postDataStart = 
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="files"; filename="product_test_${Date.now()}.png"\r\n` +
      `Content-Type: image/png\r\n\r\n`;
    
    const postDataEnd = `\r\n--${boundary}--\r\n`;

    const bodyBuffer = Buffer.concat([
      Buffer.from(postDataStart, 'utf8'),
      samplePng,
      Buffer.from(postDataEnd, 'utf8')
    ]);

    const req = client.request({
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: '/api/v1/uploads/products',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuffer.length
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', reject);
    req.write(bodyBuffer);
    req.end();
  });
}

async function verifyImageUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      resolve({ status: res.statusCode, contentType: res.headers['content-type'] });
    }).on('error', reject);
  });
}

async function run() {
  console.log('=== TEST E2E UPLOAD ANH SAN PHAM LEN CLOUDINARY ===');
  console.log(`Backend Target: ${BACKEND_URL}`);

  const urlObj = new URL(BACKEND_URL);
  const client = urlObj.protocol === 'https:' ? https : http;

  try {
    console.log('\n1. Dang nhap lay Access Token (Role ADMIN)...');
    const token = await login(client, urlObj);
    console.log('   => Dang nhap thanh cong! Token length:', token.length);

    console.log('\n2. Goi API POST /api/v1/uploads/products voi file gia lap...');
    const uploadRes = await uploadImage(client, urlObj, token);
    console.log(`   => Response Status: ${uploadRes.status}`);

    if (uploadRes.status === 201 && uploadRes.data && uploadRes.data.items) {
      const item = uploadRes.data.items[0];
      console.log('   => Upload thanh cong!');
      console.log('   => Image ID:', item.id);
      console.log('   => Cloudinary URL:', item.url);
      console.log('   => Size:', item.size, 'bytes, MIME:', item.mimeType);

      console.log('\n3. Kiem tra truy cap anh truc tiep tu Cloudinary CDN...');
      const verify = await verifyImageUrl(item.url);
      console.log(`   => CDN HTTP Status: ${verify.status}`);
      console.log(`   => CDN Content-Type: ${verify.contentType}`);

      if (verify.status === 200) {
        console.log('\n=============================================================');
        console.log('>>> KET QUA: TEST THANH CONG 100%! ANH DA XUAT HIEN TREN CLOUDINARY <<<');
        console.log(`Link xem anh truc tiep tren Cloudinary: ${item.url}`);
        console.log('=============================================================');
      } else {
        console.error('Loi: Khong the tai anh tu Cloudinary CDN.');
      }
    } else {
      console.error('Upload that bai:', uploadRes);
    }
  } catch (err) {
    console.error('Loi trong qua trinh test:', err.message);
  }
}

run();
