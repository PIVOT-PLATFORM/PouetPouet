import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@pouetpouet/shared'],
  webpack: (config) => {
    // pdfjs-dist optionally requires 'canvas' for Node.js — not needed in browser
    config.resolve.alias.canvas = false
    // @pouetpouet/shared uses ESM '.js' specifiers on .ts sources (required by
    // tsx/Node on the API side) — map them back for webpack.
    config.resolve.extensionAlias = { '.js': ['.ts', '.js'] }
    return config
  },
}

export default nextConfig
