/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Disable static optimization for API-dependent pages
  // All dashboard pages fetch live data from the backend
  output: undefined,
  transpilePackages: ['reactflow', 'react-leaflet', 'lucide-react', 'framer-motion', 'recharts'],
  experimental: {
    // Allow server actions if needed in future
  },
};

export default nextConfig;
