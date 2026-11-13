/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async redirects() {
    return [
      {
        source: '/platform',
        destination: '/platform-admin',
        permanent: false,
      },
      {
        source: '/platform/tenants',
        destination: '/platform-admin/centers',
        permanent: false,
      },
      {
        source: '/platform/tenants/create',
        destination: '/platform-admin/centers/create',
        permanent: false,
      },
      {
        source: '/platform/tenants/:id',
        destination: '/platform-admin/centers/:id',
        permanent: false,
      },
      {
        source: '/platform/subscriptions',
        destination: '/platform-admin/subscriptions',
        permanent: false,
      },
      {
        source: '/platform/support',
        destination: '/platform-admin/support',
        permanent: false,
      },
      {
        source: '/platform/:path*',
        destination: '/platform-admin/:path*',
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              // Google Fonts: the stylesheet is served from fonts.googleapis.com
              // and the font files from fonts.gstatic.com.
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https:",
              // Location map embed in the footer (OpenStreetMap).
              "frame-src 'self' https://www.openstreetmap.org",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
