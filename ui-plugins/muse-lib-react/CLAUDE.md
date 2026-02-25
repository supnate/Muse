# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@ebay/muse-lib-react` is a Muse library plugin that provides a React-based foundation for Muse applications. It bundles popular React libraries (React Router, Redux, React Query, lodash, Nice Modal) as shared modules that other plugins can re-use.

This plugin is the app entry point - it initializes React with `React.createRoot().render()` and provides extension points for customizing routing, redux store, and providers.

## Common Commands

```bash
# Install dependencies
pnpm install

# Start development server
pnpm start

# Build for production
pnpm build

# Build for development
pnpm build:dev

# Build for test environment
pnpm build:test

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:dev

# Run a single test file
pnpm test -- --watchAll=false --testPathPattern=<test-name>

# Generate API documentation
pnpm gen-muse-doc

# Deploy (builds and deploys to muse)
pnpm deploy
```

## Architecture

### Entry Point
- `src/index.js` - Plugin registration and app initialization. Registers as `@ebay/muse-lib-react` and pushes a render function to `MUSE_GLOBAL.appEntries`.

### Core Components
- `src/Root.js` - Main React root component that sets up providers (Redux, Router, React Query)
- `src/common/` - Core utilities:
  - `store.js` - Redux store configuration
  - `history.js` - Browser history for routing
  - `routeConfig.js` - Route configuration
  - `configStore.js` - Store enhancer for runtime config
  - `rootReducer.js` - Root reducers combining all plugin reducers

### Features (Plugins)
- `src/features/home/` - Homepage feature with routing and redux
- `src/features/sub-app/` - Sub-app container for loading micro-frontends in iframes
- `src/features/common/` - Shared components (ErrorBoundary, PageNotFound, etc.)

### Extension Points
This plugin exposes extension points for other plugins to customize behavior:

- `route` - Add route definitions (MuseRoute interface)
- `reducer` / `reducers` - Extend Redux store
- `root.getProviders` - Add React context providers
- `root.beforeRender` / `root.afterRender` - Lifecycle hooks
- `home.homepage` - Override homepage component
- `home.mainLayout` - Override main layout

See `MUSE.md` for the complete API.

## Key Patterns

### React Integration with Muse
The plugin uses `js-plugin` to register itself and provides a render function that:
1. Creates a root node (`#muse-react-root`)
2. Invokes `root.beforeRender` hook
3. Renders the Root component
4. Invokes `root.afterRender` and `onReady` hooks

### Testing
- Uses Jest with `@testing-library/react`
- Test files in `tests/` directory
- Mock files in `tests/__mocks__/`
- Setup file: `tests/setupAfterEnv.js`

### Build System
- Uses craco (Create React App Configuration Override) with custom plugins
- `@ebay/muse-craco-plugin` for Muse-specific configuration
- Also includes vite.config.js for potential future migration
- Uses less for stylesheets
