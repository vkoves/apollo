# Continuous Integration - run by Travis or can be run locally

# Fail out if anything errors
set -e

# Run Sass Lint verbose - cnfigured by .sass-lint.yml
sass-lint -v

# Run ESLint on the js/ directory
npx eslint js/
