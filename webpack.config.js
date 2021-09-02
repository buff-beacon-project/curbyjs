import webpack from 'webpack'
import path from 'path'
import ESLintPlugin from 'eslint-webpack-plugin'
import TerserPlugin from 'terser-webpack-plugin'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json'))

const fileName = pkg.name;
const libraryName = pkg.name;
const outputFile = fileName + '.js';

export default {
  devtool: 'source-map',
  output: {
    filename: outputFile,
    globalObject: 'this',
    library: {
      name: libraryName,
      // export: 'default',
      type: 'umd',
    }
  },
  module: {
    rules: [
      {
        test: /\.js?$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        options: {
          envName: 'browser'
        }
      }
    ]
  },
  node: {
    global: true
  },
  resolve: {
    modules: [path.resolve('./node_modules')],
    extensions: ['.json', '.js'],
    alias: {
      '@': path.resolve('./src')
    }
  },
  optimization: {
    minimizer: [new TerserPlugin({ extractComments: false })],
  },
  plugins: [
    new ESLintPlugin(),
    new webpack.BannerPlugin({
      banner: `${libraryName} version ${pkg.version}`
    })
  ],
}
