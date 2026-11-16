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
            key: 'X-XSS-Protection',
            value: '0',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              process.env.NODE_ENV === 'development'
                ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com"
                : "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https:",
              "frame-src 'self' https://www.openstreetmap.org https://challenges.cloudflare.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
