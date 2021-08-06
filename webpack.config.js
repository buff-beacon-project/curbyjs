const webpack = require('webpack')
const copy = require('fast-copy')
const path = require('path');
const pkg = require('./package.json');
const ESLintPlugin = require('eslint-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const fileName = pkg.name;
const libraryName = pkg.name;
const outputFile = fileName + '.js';

const config = {
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
    rules: []
  },
  node: {
    global: false
  },
  resolve: {
    modules: [path.resolve('./node_modules')],
    extensions: ['.json', '.js'],
    alias: {
      '@': path.join(__dirname, 'src')
    },
    fallback: {
      buffer: require.resolve('buffer')
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
};

const defaultBabelLoader = {
  test: /\.js?$/,
  exclude: /node_modules/,
  loader: 'babel-loader',
  options: {}
}

const browserConfig = copy(config)
browserConfig.module.rules = [
  Object.assign({}, defaultBabelLoader, {
    options: Object.assign({}, defaultBabelLoader.options, {
      envName: 'browser'
    })
  })
]
browserConfig.output.filename = `${fileName}.browser.js`

// Node - bundled umd file
const nodeConfig = copy(config)
nodeConfig.module.rules = [
  Object.assign({}, defaultBabelLoader, {
    options: Object.assign({}, defaultBabelLoader.options, {
      envName: 'node'
    })
  })
]
nodeConfig.target = 'node'
// nodeConfig.output.libraryTarget = 'commonjs2'
nodeConfig.output.filename = `${fileName}.node.js`
delete nodeConfig.node

module.exports = [
  browserConfig,
  nodeConfig
];
