/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['lucide-react', 'react-leaflet', 'leaflet', 'echarts', 'echarts-for-react'],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true }
};
export default nextConfig;
