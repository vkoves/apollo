module.exports = {
    'env': {
        'browser': true,
        'es6': true
    },
    'ignorePatterns': [ '**/vendor/*.js' ],
    'extends': 'eslint:recommended',
    'globals': {
        // We use jQuery, so $ is fine
        '$': 'readonly',
        'Atomics': 'readonly',
        'SharedArrayBuffer': 'readonly'
    },
    'parserOptions': {
        'ecmaVersion': 2018
    },
    'rules': {
        'indent': [
            'error',
            4
        ],
        'linebreak-style': [
            'error',
            'unix'
        ],
        'quotes': [
            'error',
            'single'
        ],
        'semi': [
            'error',
            'always'
        ]
    }
};