import nextVitals from 'eslint-config-next/core-web-vitals'

const config = [
  ...nextVitals,
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off'
    }
  },
  {
    ignores: ['node_modules/**', '.next/**', '.next-build*/**', 'out/**', 'eslint.config.mjs']
  }
]

export default config
