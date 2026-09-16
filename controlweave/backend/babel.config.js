// Used only by babel-jest during tests so Jest's CommonJS runtime can load
// ESM-only dependencies (htmlparser2 and its dom* packages, pulled in by
// sanitize-html since 2.17.6). Production runs the code directly on Node
// (>=20.19) which supports require() of ESM natively.
module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
};
