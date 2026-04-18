# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build/Lint/Test Commands

- Build: `npm run build` - Runs TypeScript and Vite build
- Development: `npm run dev` or `npm start` - Starts Vite dev server
- Lint: `npm run lint` - Runs ESLint on src directory
- Lint + Fix: `npm run lint:fix` - Auto-fixes linting issues
- Format check: `npm run format` - Checks formatting with Prettier
- Format fix: `npm run format:fix` - Applies Prettier formatting
- Type check: `npm run type-check` - Runs TypeScript type check without emitting

## Code Style Guidelines

- TypeScript with strict mode enabled (noUnusedLocals, noUnusedParameters)
- ES modules with simple-import-sort plugin for import ordering
- Class-based component architecture with explicit interface implementation
- PascalCase for classes/interfaces, camelCase for methods/properties
- Document classes with JSDoc comments (especially public APIs)
- Handle errors with appropriate logging/fallbacks
- 2-space indentation, single quotes, trailing commas

## Project Architecture

- Engine layer (`src/engine/`) - Core abstractions over Pixi.js
- Application layer (`src/app/`) - Game-specific implementations
- Screen-based navigation system with lifecycle methods (show, hide, pause, resume)
- VirtualScreen maintains 1920x1080 design resolution with automatic scaling
- Spine animations for character/background animations
- GSAP for UI animations and transitions

## Key Design Patterns

- Component composition over inheritance
- Event-driven communication between objects
- Singleton access pattern via `engine()` helper
- Screen transitions via NavigationPlugin
- Asset management with preloading and background loading

## Working with Assets

- Assets stored in `raw-assets/` processed by AssetPack
- Use existing asset loading patterns via Assets.loadBundle
- Follow atlas/spine structure for animations
- Audio split between BGM (background music) and SFX (sound effects)
- Always call destroy() on disposable resources
