// Nama cache unik untuk aplikasi Anda. Ubah ini jika Anda membuat perubahan besar pada file yang di-cache.
// Ubah versi cache (v1 -> v2) saat ada update file aset
const CACHE_NAME = 'franchiseku-cache-v2';

// Daftar file yang akan di-cache saat service worker diinstal (PRE-CACHE).
// Service worker akan memaksa mengambil ini saat instalasi.
const urlsToCache = [
  // ASET UTAMA & DIBUTUHKAN OFFLINE
  '/',
  '/index.html',
  '/manifest.json', // Tambahkan manifest

  // ASET LOKAL (SESUAIKAN DENGAN STRUKTUR FOLDER ASLI ANDA)
  // Saya asumsikan file CSS dan JS utama kini berada di root atau memiliki nama spesifik:
  // '/styles/main.css',          // <-- Ganti dengan path file CSS utama Anda
  // '/scripts/main.js',          // <-- Ganti dengan path file JS utama Anda
  '/icon-192x192.png',         
  '/icon-512x512.png',         
  '/icon-maskable-512x512.png',

  // ASET EKSTERNAL (Pastikan URL ini benar-benar statis dan penting saat offline)
  // Perhatikan: Meng-cache aset Google Fonts (CSS) tidak berarti meng-cache font-nya.
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap',
  'https://unpkg.com/@phosphor-icons/web',
  'https://cdn.jsdelivr.net/npm/chart.js',

  // JALUR FIREBASE SDK DARI KODE INDEX.HTML (PENTING UNTUK OFFLINE!)
  'https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js', 
  'https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore-compat.js'
];

// Event 'install': Dipicu saat service worker pertama kali diinstal.
self.addEventListener('install', event => {
    // Memaksa Service Worker untuk mengabaikan Waiting State dan segera aktif
    self.skipWaiting();
    
    // Tunggu hingga proses caching selesai sebelum melanjutkan.
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => {
            console.log('Service Worker: Cache dibuka. Mulai pre-caching aset inti.');
            // Menambahkan semua URL dari daftar ke dalam cache.
            // Jika salah satu URL gagal, seluruh instalasi SW gagal!
            return cache.addAll(urlsToCache);
        })
        .catch(error => {
            console.error('Service Worker: Gagal caching aset inti. Instalasi gagal!', error);
        })
    );
});

// Event 'activate': Dipicu saat service worker diaktifkan.
// Digunakan untuk membersihkan cache versi lama.
self.addEventListener('activate', event => {
    // Memaksa klien untuk menggunakan Service Worker baru setelah aktivasi
    event.waitUntil(self.clients.claim());
    
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Hapus cache yang tidak ada dalam whitelist (cache versi lama).
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('Service Worker: Membersihkan cache lama:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Event 'fetch': Dipicu setiap kali aplikasi membuat permintaan jaringan.
self.addEventListener('fetch', event => {
    // Jangan cache permintaan yang bukan GET (seperti POST ke Firebase)
    if (event.request.method !== 'GET') {
        // Biarkan permintaan jaringan berjalan tanpa intervensi Service Worker
        return;
    }
    
    // Strategi Caching: Cache-First untuk aset inti, Network-First untuk lainnya.
    event.respondWith(
        caches.match(event.request).then(response => {
            // 1. Jika permintaan ditemukan di cache (Cache-First), langsung kembalikan.
            if (response) {
                return response;
            }

            // 2. Jika tidak ditemukan di cache, lanjutkan ke jaringan (Network-First).
            return fetch(event.request).then(networkResponse => {
                // Periksa jika respons valid (status 200, bukan ekstensi, dll.)
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                // 3. JIKA LOKASI ADALAH GOOGLE FONTS (untuk meng-cache file font yang sebenarnya)
                if (event.request.url.startsWith('https://fonts.gstatic.com')) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                
                // Kembalikan respons dari jaringan
                return networkResponse;
            }).catch(error => {
                // JIKA JARINGAN GAGAL TOTAL
                console.error('Service Worker: Gagal mengambil aset dari jaringan:', event.request.url, error);
                
                // Anda bisa mengembalikan fallback spesifik di sini, misalnya gambar offline
                // atau aset HTML/CSS default jika aset utama yang diminta gagal.
                // Karena kita sudah mengaktifkan persistence di Firestore, fokus Service Worker
                // adalah meng-cache aset tampilan (CSS, JS).
            });
        })
    );
});