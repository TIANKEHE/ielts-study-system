import type {NextConfig} from 'next';
const config:NextConfig={distDir:process.env.IELTS_BUILD_DIR||'.next',turbopack:{root:process.cwd()},webpack(config){config.watchOptions={...config.watchOptions,poll:1000,ignored:['**/node_modules/**','**/.git/**','**/work/**','**/prisma/*.db*']};return config;}};
export default config;
