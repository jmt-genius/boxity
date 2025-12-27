# Boxity Frontend - Project Standards & Guidelines

## Project Overview

**Boxity Frontend** is a React + TypeScript + Vite application focused on supply chain trust and verification. It features advanced animations, 3D components, wallet integration, and QR code scanning capabilities.

- **Framework**: React 18.3.1 with TypeScript
- **Build Tool**: Vite 5.4.19
- **Styling**: Tailwind CSS 3.4.17 with custom theme
- **UI Components**: Radix UI (comprehensive component library)
- **Animations**: GSAP, Framer Motion, Three.js
- **State Management**: React Query (TanStack Query)
- **Routing**: React Router v6
- **Forms**: React Hook Form + Zod validation
- **Backend Integration**: Pinata (IPFS), Insforge, Custom API

---

## Tech Stack & Key Dependencies

### Core Libraries
- **React & React DOM**: 18.3.1 - UI framework
- **TypeScript**: 5.8.3 - Type safety
- **Vite**: 5.4.19 - Build tool with HMR
- **React Router**: 6.30.1 - Client-side routing
- **React Query**: 5.83.0 - Server state management

### UI & Styling
- **Tailwind CSS**: 3.4.17 - Utility-first CSS
- **Radix UI**: Comprehensive accessible component library
- **Lucide React**: 0.462.0 - Icon library
- **Framer Motion**: 12.23.24 - Animation library
- **GSAP**: 3.13.0 - Advanced animations
- **Three.js**: 0.160.1 - 3D graphics
- **React Three Fiber**: 8.18.0 - React renderer for Three.js
- **React Three Drei**: 9.122.0 - Useful helpers for Three.js

### Forms & Validation
- **React Hook Form**: 7.61.1 - Form state management
- **Zod**: 3.25.76 - Schema validation
- **@hookform/resolvers**: 3.10.0 - Form validation integration

### Web3 & Integration
- **Ethers.js**: 6.15.0 - Ethereum library
- **@insforge/sdk**: Latest - Insforge integration
- **QRCode**: 1.5.4 - QR code generation
- **html5-qrcode**: 2.3.8 - QR code scanning

### Utilities
- **Date-fns**: 3.6.0 - Date manipulation
- **Sonner**: 1.7.4 - Toast notifications
- **Recharts**: 2.15.4 - Charts & graphs
- **Embla Carousel**: 8.6.0 - Carousel component
- **Next Themes**: 0.3.0 - Theme management

---

## Project Structure

```
src/
├── components/          # Reusable React components
│   ├── ui/             # Radix UI based components
│   ├── Navbar.tsx      # Navigation component
│   ├── AnimatedCubes.tsx
│   ├── AnimatedText.tsx
│   ├── AnimatedTimeline.tsx
│   ├── Box3D.tsx
│   ├── GlassCard.tsx
│   ├── ParticleField.tsx
│   ├── QRScanner.tsx
│   ├── WalletConnect.tsx
│   └── [other animated/interactive components]
├── pages/              # Page components (route-based)
│   ├── Index.tsx       # Home page
│   ├── Admin.tsx       # Admin dashboard
│   ├── LogEvent.tsx    # Event logging
│   ├── Verify.tsx      # Verification page
│   ├── IntegrityCheck.tsx
│   └── NotFound.tsx    # 404 page
├── contexts/           # React Context providers
│   └── ThemeContext.tsx # Light/Dark theme management
├── hooks/              # Custom React hooks
├── lib/                # Utility functions & helpers
├── App.tsx             # Root component with routing
├── main.tsx            # Entry point
├── index.css           # Global styles
└── App.css             # App-specific styles
```

---

## Code Style & Conventions

### TypeScript
- **Strict Mode**: Enabled for type safety
- **Path Aliases**: Use `@/*` for imports from `src/`
  ```typescript
  // ✅ Good
  import { Button } from '@/components/ui/button';
  
  // ❌ Avoid
  import { Button } from '../../../components/ui/button';
  ```
- **Type Definitions**: Always define component props with interfaces/types
  ```typescript
  interface ComponentProps {
    title: string;
    onClick: () => void;
    disabled?: boolean;
  }
  ```

### React Components
- **Functional Components**: Use only functional components with hooks
- **Component Naming**: PascalCase for components, camelCase for utilities
- **Props Pattern**: Use destructuring in function parameters
  ```typescript
  const MyComponent: React.FC<MyComponentProps> = ({ title, onClick }) => {
    return <button onClick={onClick}>{title}</button>;
  };
  ```
- **Hooks**: Place hooks at the top of component body
- **Event Handlers**: Prefix with `handle` (e.g., `handleClick`, `handleSubmit`)

### Styling
- **Tailwind CSS**: Primary styling approach
- **CSS Modules**: Use for component-specific styles when needed
- **Custom CSS**: Minimal; prefer Tailwind utilities
- **Theme Variables**: Use CSS custom properties defined in theme context
  ```css
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  ```

### File Organization
- **One Component Per File**: Each component in its own file
- **Index Files**: Use `index.ts` for barrel exports in folders
- **Naming**: Match filename to component name (e.g., `Button.tsx` exports `Button`)

---

## Routing & Pages

Routes are defined in `App.tsx` using React Router v6:

```typescript
<Routes>
  <Route path="/" element={<Index />} />
  <Route path="/admin" element={<Admin />} />
  <Route path="/log-event" element={<LogEvent />} />
  <Route path="/verify" element={<Verify />} />
  <Route path="/integrity-check" element={<IntegrityCheck />} />
  <Route path="*" element={<NotFound />} />
</Routes>
```

**Important**: Add all custom routes ABOVE the catch-all `"*"` route.

---

## State Management

### React Query (Server State)
- Use for API calls and server state
- Configure in `App.tsx` with `QueryClient`
- Example:
  ```typescript
  const { data, isLoading, error } = useQuery({
    queryKey: ['events'],
    queryFn: fetchEvents,
  });
  ```

### Context API (Client State)
- **ThemeContext**: Manages light/dark theme
- Create new contexts in `src/contexts/` for global state
- Use custom hooks to access context (e.g., `useTheme()`)

### Local State
- Use `useState` for component-level state
- Use `useReducer` for complex state logic

---

## Forms & Validation

### React Hook Form + Zod
- Define schemas with Zod
- Use `useForm` hook with resolver
- Example:
  ```typescript
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
  });

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });
  ```

---

## Environment Variables

Located in `.env`:

```
REACT_APP_PINATA_API_KEY=<key>
REACT_APP_PINATA_SECRET_API_KEY=<secret>
VITE_PINATA_JWT=<jwt>
VITE_BACKEND_URL=https://boxity.onrender.com
VITE_INSFORGE_BASE_URL=https://fu5pg5wg.ap-southeast.insforge.app
VITE_INSFORGE_ANON_KEY=<key>
```

**Important**: Never commit sensitive keys. Use `.env.local` for local overrides.

---

## Build & Development

### Scripts
```bash
npm run dev        # Start dev server (Vite HMR on port 8080)
npm run build      # Build for production (TypeScript + Vite)
npm run lint       # Run ESLint
npm run preview    # Preview production build
```

### Development Server
- Runs on `http://[::]:8080`
- Hot Module Replacement (HMR) enabled
- Component tagging with Lovable Tagger in dev mode

### Build Output
- Output directory: `dist/`
- TypeScript compilation before Vite build
- Optimized for production

---

## ESLint Configuration

- **Parser**: TypeScript ESLint
- **Plugins**: React Hooks, React Refresh
- **Rules**: Recommended configuration
- **Recommended Enhancement**: Enable type-aware rules for production apps

Run linting:
```bash
npm run lint
```

---

## Key Features & Patterns

### Animations
- **GSAP**: Complex, timeline-based animations
- **Framer Motion**: React-friendly motion library
- **Three.js**: 3D graphics and effects
- **CSS Animations**: Tailwind's animation utilities

### 3D Components
- Built with Three.js + React Three Fiber
- Located in `src/components/` (e.g., `Box3D.tsx`, `AnimatedCubes.tsx`)
- Use `@react-three/drei` for helpers

### QR Code
- **Generation**: `qrcode` library
- **Scanning**: `html5-qrcode` library
- Components: `QRScanner.tsx`, `QRScanAnimator.tsx`

### Wallet Integration
- **WalletConnect.tsx**: Wallet connection component
- Uses Ethers.js for blockchain interaction

### Theme System
- **ThemeContext**: Manages light/dark mode
- Persists to localStorage
- Applies to document root class

---

## Performance Considerations

- **Code Splitting**: React Router enables automatic route-based splitting
- **Image Optimization**: Use appropriate formats and sizes
- **Bundle Analysis**: Monitor with Vite's build analysis
- **React Query**: Caching and background refetching
- **Lazy Loading**: Use `React.lazy()` for route components if needed

---

## Accessibility

- **Radix UI**: Built-in accessibility features
- **ARIA Labels**: Use for interactive elements
- **Keyboard Navigation**: Ensure all interactive elements are keyboard accessible
- **Color Contrast**: Maintain WCAG AA standards

---

## Common Patterns

### Creating a New Page
1. Create file in `src/pages/PageName.tsx`
2. Add route in `App.tsx`
3. Import and use in Routes

### Creating a New Component
1. Create file in `src/components/ComponentName.tsx`
2. Define props interface
3. Export as default
4. Use path alias for imports

### Adding a New Context
1. Create file in `src/contexts/ContextName.tsx`
2. Create context with `createContext`
3. Create provider component
4. Export custom hook for accessing context

---

## Debugging & Development Tools

- **React DevTools**: Browser extension for React debugging
- **Vite DevTools**: Built-in Vite debugging
- **TypeScript**: Provides compile-time type checking
- **ESLint**: Catches code quality issues
- **Console**: Use for debugging (remove before production)

---

## Dependencies Management

- **Node Version**: Check `.nvmrc` or `package.json` engines field
- **npm**: Use `npm install` to install dependencies
- **Updates**: Review breaking changes before updating major versions
- **Security**: Run `npm audit` regularly

---

## Deployment

- **Build Command**: `npm run build`
- **Output**: `dist/` directory
- **Backend**: Connected to `https://boxity.onrender.com`
- **Environment**: Set environment variables in deployment platform

---

## Resources & Documentation

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Radix UI Components](https://www.radix-ui.com/docs/primitives/overview/introduction)
- [React Router](https://reactrouter.com/)
- [React Query](https://tanstack.com/query/latest)
- [GSAP Documentation](https://gsap.com/docs/)
- [Three.js Documentation](https://threejs.org/docs/)
