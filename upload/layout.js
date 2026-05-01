// src/app/layout.js
import './globals.css';

export const metadata = {
  title: 'Sistem Informasi Perikanan Budidaya - Dinas Perikanan Kab. Mempawah',
  description: 'Sistem Informasi Perikanan Budidaya Dinas Perikanan Kabupaten Mempawah, Kalimantan Barat',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          crossOrigin=""
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
