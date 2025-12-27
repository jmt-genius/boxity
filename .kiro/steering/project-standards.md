---
inclusion: always
---

# Boxity Project Standards & Development Guidelines

This document outlines the standards, conventions, and best practices for the Boxity supply chain provenance platform across all three projects: backend, frontend, and mobile.

---

## Project Overview

**Boxity** is a multi-stack supply chain trust & transparency platform with three main components:

1. **boxity_backend** - Python Flask API for AI-powered image integrity analysis
2. **boxity_frontend** - React + Vite web application for QR scanning and batch management
3. **app/boxity_mobile** - React Native/Expo mobile app for field scanning

---

## Technology Stack Summary

### Backend (boxity_backend)
- **Language:** Python 3.x
- **Framework:** Flask 3.0.3
- **Package Manager:** pip with virtual environment (venv)
- **Key Libraries:** google-generativeai, Pillow, opencv-python-headless, numpy, requests, jsonschema, flask-cors
- **Server:** Gunicorn (production), Flask dev server (development)
- **Port:** 5000 (configurable via FLASK_RUN_PORT)
- **Deployment:** Render (production)

### Frontend (boxity_frontend)
- **Language:** TypeScript
- **Framework:** React 18.3.1 + Vite 5.4.19
- **Package Manager:** npm
- **Styling:** TailwindCSS 3.4.17 + PostCSS
- **UI Components:** shadcn/ui (Radix UI primitives)
- **Key Libraries:** react-router-dom, framer-motion, qrcode, ethers, @tanstack/react-query, react-hook-form, zod, three.js, recharts
- **Dev Server:** Vite (port 8080)
- **Build Tool:** Vite with SWC
- **Deployment:** Vercel (production)

### Mobile (app/boxity_mobile)
- **Language:** TypeScript
- **Framework:** React Native 0.81.5 + Expo 54.0.27
- **Package Manager:** Bun (primary), npm (fallback)
- **Routing:** Expo Router (file-based)
- **Key Libraries:** expo-camera, expo-image-picker, @elevenlabs/elevenlabs-js, @tanstack/react-query, zustand, axios
- **Deployment:** Expo (tunnel-based development)

---

## Development Workflow

### Backend Setup
```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# For development (includes OpenCV, NumPy)
pip install -r dev-requirements.txt

# Set environment variables
export GOOGLE_API_KEY="your-key"
export FLASK_APP="api.index:app"
export FLASK_ENV="development"
export FLASK_RUN_PORT="5000"

# Run development server
flask run
```

### Frontend Setup
```bash
# Install dependencies
npm install

# Start development server (port 8080)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

### Mobile Setup
```bash
# Install dependencies with Bun
bun install

# Or with npm
npm install

# Start development with tunnel
bunx rork start -p <project-id> --tunnel

# Start web variant
bunx rork start -p <project-id> --web --tunnel

# Debug web variant
DEBUG=expo* bunx rork start -p <project-id> --web --tunnel

# Lint code
expo lint
```

---

## Code Organization & Structure

### Backend (Python/Flask)
```
boxity_backend/
├── api/
│   ├── index.py          # Main Flask app, routing, request handling
│   ├── ai.py             # Gemini integration, call_gemini_ensemble()
│   ├── vision.py         # Classical CV fallback, align_and_normalize()
│   ├── schema.py         # JSON schema definitions for validation
│   └── utils.py          # Helper functions
├── .env                  # Environment variables (GOOGLE_API_KEY, FLASK_APP, etc.)
├── requirements.txt      # Production dependencies
├── dev-requirements.txt  # Development-only dependencies
└── README.md             # Architecture documentation
```

**Key Principles:**
- Modular organization with clear separation of concerns
- Each module has a single responsibility (routing, AI, vision, validation)
- Error handling with graceful fallbacks (Gemini → OpenCV)
- Configuration via environment variables
- JSON schema validation for all API responses

### Frontend (React/TypeScript)
```
boxity_frontend/
├── src/
│   ├── pages/            # Page components (Home, Admin, LogEvent, Verify)
│   ├── components/       # Reusable UI components
│   ├── contexts/         # React Context (ThemeContext, etc.)
│   ├── hooks/            # Custom hooks
│   ├── lib/              # Utility libraries
│   ├── utils/            # Helper functions
│   ├── types/            # TypeScript type definitions
│   └── App.tsx           # Main app component
├── .env                  # Environment variables (VITE_BACKEND_URL, API keys)
├── vite.config.ts        # Vite configuration with React SWC plugin
├── tsconfig.json         # TypeScript config with path aliases (@/*)
├── tailwind.config.ts    # TailwindCSS theme customization
├── postcss.config.js     # PostCSS plugins
├── eslint.config.js      # ESLint rules
└── index.html            # Entry point
```

**Key Principles:**
- Functional components with React hooks
- TypeScript for type safety (noImplicitAny: false for flexibility)
- Path aliases: @/* maps to src/*
- TailwindCSS for styling with shadcn/ui components
- React Context + localStorage for state management
- Framer Motion for animations
- React Router for client-side routing

### Mobile (React Native/Expo)
```
app/boxity_mobile/
├── app/                  # Expo Router file-based routing
│   ├── (tabs)/           # Tab-based navigation
│   ├── (auth)/           # Authentication screens
│   └── index.tsx         # Root route
├── components/           # Reusable components (ThemedText, ThemedView)
├── contexts/             # React Context (AppContext, AuthContext)
├── hooks/                # Custom hooks (useColorScheme, useThemeColor)
├── services/             # API services (api.ts, database.ts, tts.ts, mediapipe.ts, ipfs.ts)
├── types/                # TypeScript type definitions
├── utils/                # Helper functions
├── constants/            # Constants and configuration
├── app.json              # Expo configuration
├── tsconfig.json         # TypeScript config
└── package.json          # Dependencies and scripts
```

**Key Principles:**
- File-based routing via Expo Router (app/ directory)
- Modular services for API, database, TTS, MediaPipe, IPFS
- Zustand for state management + AsyncStorage for persistence
- React Context for theme and app-wide state
- TypeScript with strict mode enabled
- Themed components for consistent styling

---

## API Endpoints & Response Schema

### Backend API Endpoints

#### GET `/`
Health check endpoint.
```json
{ "status": "ok" }
```

#### GET `/about`
Information endpoint.
```json
{ "version": "1.0.0", "description": "Boxity Backend" }
```

#### POST `/analyze`
Main image integrity analysis endpoint.

**Request:**
```json
{
  "baseline_b64": "base64-encoded-image",
  "current_b64": "base64-encoded-image"
}
```
OR
```json
{
  "baseline_url": "https://example.com/image1.jpg",
  "current_url": "https://example.com/image2.jpg"
}
```

**Response:**
```json
{
  "differences": [
    {
      "id": "diff-001",
      "region": "top-left",
      "bbox": [10, 20, 100, 150],
      "type": "dent",
      "description": "Physical dent detected",
      "severity": "HIGH",
      "confidence": 0.95,
      "explainability": ["Surface deformation", "Shadow pattern"],
      "suggested_action": "Inspect package",
      "tis_delta": -40
    }
  ],
  "aggregate_tis": 60,
  "overall_assessment": "MODERATE_RISK",
  "confidence_overall": 0.92,
  "notes": "Package shows signs of handling damage",
  "metadata": {
    "total_differences": 1,
    "high_severity_count": 1,
    "medium_severity_count": 0,
    "low_severity_count": 0,
    "analysis_timestamp": "2025-12-28T10:30:00Z"
  }
}
```

**Response Schema Validation:**
- All responses validated against JSON schema (schema.py)
- Difference items must include: id, region, type, description, severity, confidence, explainability, suggested_action, tis_delta
- TIS (Trust Integrity Score): 0-100 scale
- Assessment levels: SAFE (80-100), MODERATE_RISK (40-79), HIGH_RISK (0-39)

---

## Naming Conventions

### Python (Backend)
- **Functions:** snake_case (e.g., `call_gemini_ensemble`, `align_and_normalize`)
- **Classes:** PascalCase (e.g., `ImageAnalyzer`, `GeminiClient`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `DIFFERENCE_ITEM_SCHEMA`, `MAX_IMAGE_SIZE`)
- **Private methods:** _leading_underscore (e.g., `_validate_response`)
- **Files:** snake_case (e.g., `api.py`, `schema.py`, `vision.py`)

### TypeScript/JavaScript (Frontend & Mobile)
- **Functions:** camelCase (e.g., `analyzeImage`, `fetchBatches`)
- **Components:** PascalCase (e.g., `AdminDashboard`, `QRScanner`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `API_BASE_URL`, `MAX_FILE_SIZE`)
- **Types/Interfaces:** PascalCase (e.g., `Batch`, `AnalysisResult`)
- **Files:** kebab-case for utilities (e.g., `api-client.ts`), PascalCase for components (e.g., `AdminDashboard.tsx`)
- **Hooks:** camelCase with 'use' prefix (e.g., `useColorScheme`, `useBatches`)

---

## Type Safety & Validation

### Backend (Python)
- Use type hints for all functions: `def analyze(image: str) -> Dict[str, Any]:`
- Validate all API inputs using jsonschema
- Use Optional[] for nullable values
- Document complex types in schema.py

### Frontend (React/TypeScript)
- Enable strict TypeScript mode where possible
- Define interfaces for all data structures
- Use Zod for runtime validation of API responses
- Avoid `any` type; use `unknown` if necessary
- Document complex types in types/ folder

### Mobile (React Native/TypeScript)
- Strict TypeScript mode enabled
- Define interfaces for all data structures
- Use type guards for runtime validation
- Document complex types in types/ folder

---

## Error Handling & Logging

### Backend
- Use try-catch blocks with graceful fallbacks
- Log errors to stderr with context
- Return meaningful error messages in JSON responses
- Implement fallback pipelines (Gemini → OpenCV)
- Example:
```python
try:
    result = call_gemini_ensemble(baseline_img, current_img)
except Exception as e:
    print(f"Gemini failed: {e}", file=sys.stderr)
    result = align_and_normalize(baseline_img, current_img)  # Fallback
```

### Frontend
- Use try-catch for async operations
- Display user-friendly error messages
- Log errors to console in development
- Implement error boundaries for React components
- Example:
```typescript
try {
  const result = await analyzeImages(baseline, current);
} catch (error) {
  console.error('Analysis failed:', error);
  setError('Failed to analyze images. Please try again.');
}
```

### Mobile
- Use try-catch for async operations
- Display toast notifications for errors
- Log errors with context
- Implement error recovery mechanisms

---

## Environment Variables

### Backend (.env)
```
GOOGLE_API_KEY=your-gemini-api-key
FLASK_APP=api.index:app
FLASK_ENV=development
FLASK_RUN_PORT=5000
```

### Frontend (.env)
```
VITE_BACKEND_URL=http://localhost:5000
VITE_PINATA_API_KEY=your-pinata-key
VITE_PINATA_SECRET_API_KEY=your-pinata-secret
VITE_PINATA_JWT=your-pinata-jwt
VITE_INSFORGE_BASE_URL=https://api.insforge.com
VITE_INSFORGE_ANON_KEY=your-insforge-key
```

### Mobile (.env)
```
EXPO_PUBLIC_API_URL=https://boxity.onrender.com
EXPO_PUBLIC_INSFORGE_BASE_URL=https://api.insforge.com
EXPO_PUBLIC_INSFORGE_ANON_KEY=your-insforge-key
```

**Important:** Never commit .env files. Use .env.example for templates.

---

## Code Quality Standards

### Linting & Formatting

**Backend (Python):**
- Use PEP 8 style guide
- Consider using Black for code formatting
- Use pylint or flake8 for linting

**Frontend (TypeScript/React):**
- ESLint configuration: `npm run lint`
- Follow React best practices
- Use Prettier for consistent formatting

**Mobile (TypeScript/React Native):**
- ESLint configuration: `expo lint`
- Follow React Native best practices
- Consistent with frontend standards

### Type Checking

**Backend:**
- Use type hints for all functions
- Validate inputs with jsonschema

**Frontend & Mobile:**
- Run TypeScript compiler: `tsc -b` (frontend)
- Enable strict mode where possible
- Use Zod for runtime validation

---

## Testing Strategy

### Backend
- Unit tests for image analysis logic
- Integration tests for API endpoints
- Test both Gemini and OpenCV pipelines
- Validate response schema compliance

### Frontend
- Unit tests for components and utilities
- Integration tests for page workflows
- E2E tests for critical user journeys (QR scanning, batch verification)
- Test theme switching and localStorage persistence

### Mobile
- Unit tests for services and utilities
- Integration tests for navigation and state management
- E2E tests on physical devices or emulators
- Test camera permissions and image capture

---

## Performance Optimization

### Backend
- Image preprocessing (alignment, normalization)
- Gemini ensemble for accuracy
- Classical CV fallback for reliability
- Cache analysis results when appropriate
- Optimize image loading (Pillow lazy loading)

### Frontend
- Lazy load components with React.lazy()
- Optimize bundle size with tree-shaking
- Use React.memo for expensive components
- Implement virtual scrolling for large lists
- Cache API responses with @tanstack/react-query

### Mobile
- Lazy load screens with Expo Router
- Optimize image sizes before upload
- Use AsyncStorage for local caching
- Implement pagination for large datasets
- Profile performance with React Native DevTools

---

## Security Considerations

### Backend
- API keys in .env (never commit)
- CORS configuration for frontend/mobile origins
- Input validation for all endpoints
- Schema validation for responses
- Secure image handling (base64/URL validation)
- Rate limiting for API endpoints

### Frontend
- Never expose API keys in client code
- Use environment variables for sensitive data
- Validate user input before sending to API
- Implement CSRF protection if needed
- Secure localStorage usage (no sensitive data)

### Mobile
- Never hardcode API keys
- Use secure storage for sensitive data
- Validate SSL certificates
- Implement app-level security checks
- Request permissions explicitly

---

## Deployment & Hosting

### Backend
- **Development:** Flask dev server (port 5000)
- **Production:** Gunicorn on Render
- **Environment:** Set FLASK_ENV=production
- **Monitoring:** Check Render logs for errors

### Frontend
- **Development:** Vite dev server (port 8080)
- **Production:** Static build to /dist, deployed on Vercel
- **Build command:** `npm run build`
- **Environment:** Set VITE_BACKEND_URL to production API

### Mobile
- **Development:** Expo tunnel-based development
- **Distribution:** Expo Go app or custom build (iOS/Android)
- **Build:** Use Expo EAS for production builds

---

## Git Workflow & Commit Messages

### Branch Naming
- Feature: `feature/description` (e.g., `feature/qr-scanner`)
- Bug fix: `fix/description` (e.g., `fix/image-analysis-crash`)
- Hotfix: `hotfix/description` (e.g., `hotfix/api-timeout`)

### Commit Messages
- Use imperative mood: "Add feature" not "Added feature"
- Keep first line under 50 characters
- Reference issues: "Fix #123: Description"
- Example: `feat: add image integrity analysis endpoint`

### Pull Requests
- Describe changes clearly
- Link related issues
- Request review from team members
- Ensure CI/CD checks pass

---

## Documentation Standards

### Code Comments
- Comment complex logic, not obvious code
- Use docstrings for functions and classes
- Include examples for non-obvious usage
- Keep comments up-to-date with code

### README Files
- Include project overview
- Document setup instructions
- List key features
- Provide usage examples
- Link to deployment

### API Documentation
- Document all endpoints with request/response examples
- Include error codes and messages
- Provide curl examples
- Use OpenAPI/Swagger if applicable

---

## Common Tasks & Commands

### Backend
```bash
# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run development server
flask run

# Run with specific port
FLASK_RUN_PORT=8000 flask run

# Test API endpoint
curl -X POST http://localhost:5000/analyze \
  -H "Content-Type: application/json" \
  -d '{"baseline_b64": "...", "current_b64": "..."}'
```

### Frontend
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Preview production build
npm run preview
```

### Mobile
```bash
# Install dependencies
bun install

# Start development
bunx rork start -p <project-id> --tunnel

# Start web variant
bunx rork start -p <project-id> --web --tunnel

# Lint code
expo lint
```

---

## Troubleshooting

### Backend Issues
- **Import errors:** Ensure virtual environment is activated
- **API key errors:** Check GOOGLE_API_KEY in .env
- **Port conflicts:** Change FLASK_RUN_PORT or kill existing process
- **Image processing errors:** Check Pillow and OpenCV installation

### Frontend Issues
- **Port 8080 in use:** Kill existing Vite process or change port
- **Module not found:** Run `npm install` and check path aliases
- **TypeScript errors:** Run `tsc -b` to check compilation
- **Build failures:** Clear node_modules and reinstall

### Mobile Issues
- **Tunnel connection failed:** Check internet connection and Expo account
- **Camera permission denied:** Check app permissions in device settings
- **Module not found:** Run `bun install` or `npm install`
- **Build errors:** Clear cache with `expo start --clear`

---

## Resources & References

- **Backend:** [Flask Documentation](https://flask.palletsprojects.com/), [Google Generative AI](https://ai.google.dev/)
- **Frontend:** [React Documentation](https://react.dev/), [Vite Guide](https://vitejs.dev/), [TailwindCSS](https://tailwindcss.com/)
- **Mobile:** [Expo Documentation](https://docs.expo.dev/), [React Native](https://reactnative.dev/)
- **Project README:** See root README.md for project overview
- **Backend Architecture:** See boxity_backend/README.md for detailed API documentation

---

## Questions & Support

For questions or issues:
1. Check existing documentation
2. Review similar code patterns in the project
3. Check error logs and console output
4. Consult team members or project maintainers
