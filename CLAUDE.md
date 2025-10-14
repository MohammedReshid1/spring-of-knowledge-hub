# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend (Vite React)
- `npm run dev` - Start Vite development server on http://localhost:8080
- `npm run build` - Build production-ready frontend assets
- `npm run lint` - Run ESLint for frontend code quality
- `npm run test` - Run frontend tests (e.g., Jest, React Testing Library)

### Backend (FastAPI with MongoDB)
- `uvicorn app.main:app --reload` - Run FastAPI development server with hot reload on http://127.0.0.1:8000
- `./start_backend.sh` - Start backend using project script
- `poetry run pytest` or `pytest` - Run backend tests
- Use MongoDB tools and drivers (e.g., `mongosh` or MongoDB Compass) for database operations

### Deployment
- **Frontend**: Build static files and serve via CDN or static hosting (e.g., Vercel, Netlify)
- **Backend**: Deploy FastAPI with ASGI server (e.g. Uvicorn, Gunicorn) behind a reverse proxy
- **MongoDB**: Use managed MongoDB service or self-hosted instance with secure access

## Architecture Overview

### Core Technology Stack
- **Frontend Framework**: React 18 with Vite for fast bundling and HMR
- **Backend Framework**: FastAPI Python framework supporting async, with Pydantic data validation
- **Database**: MongoDB document store accessed via Motor (async MongoDB Python driver)
- **Authentication**: JWT token-based auth, integrated with FastAPI security utilities
- **State Management**: React Context or Zustand for client state management
- **UI Components**: Tailwind CSS with Headless UI or component libraries like Radix UI or Material UI
- **Validation**: Pydantic schemas on backend, React Hook Form with Zod (or Yup) validation frontend
- **Real-time**: WebSocket support in FastAPI or external services (e.g. Pusher, Firebase) for real-time features
- **File Storage**: Cloudinary or AWS S3 for image/file uploads with secure backend APIs

### Role-Based Access Control (RBAC)
- Replace traditional static RBAC with a dynamic RBAC system
- Dynamically control frontend component visibility and API route permissions based on user roles and permissions fetched at runtime
- Backend middleware enforces role and permission checks on each API request
- Frontend obtains user roles/permissions from auth token or API and conditionally renders UI accordingly
- Design RBAC to allow easy role modifications without code redeployment

### Database Schema (MongoDB Collections)
Key collections:
- `users` — Store user credentials, roles, and authentication info
- `profiles` — Extended user profile data linked by user ID
- `photos` — User image metadata with moderation status
- `likes` — Relationships between users for "like" features
- `messages` — Chat or communication messages with read status
- `tokens` — Email verification, password reset tokens with expiry

### Authentication Flow
- JWT token authentication with FastAPI security middleware
- Email verification required to activate account
- After registration, profile completion enforced before accessing main features
- Role and permission claims included in JWT tokens
- Frontend uses token to fetch user info and enforce UI RBAC

### Project Structure
**Frontend (Vite React)**
```
/src
  /assets/           # Static assets: images, fonts
  /components/       # Reusable React components
  /contexts/         # React contexts and providers (e.g., Auth, RBAC)
  /hooks/            # Custom hooks
  /pages/            # Page-level React components / routes
  /services/         # API clients and utilities
  /styles/           # Tailwind and global CSS styles
  /utils/            # Utility functions
  main.jsx           # React app entry point
  App.jsx            # Root app component with routing
```

**Backend (FastAPI)**
```
/app
  /api               # API route modules
  /core              # Core app configs (security, settings)
  /db                # MongoDB client and collection definitions
  /models            # Pydantic models and schemas
  /services          # Business logic and service layers
  /auth              # Authentication and RBAC logic
  /utils             # Utility functions
  main.py            # FastAPI app instantiation and routing
  websocket.py       # WebSocket endpoints if any
```

### State Management
- Use React Context or Zustand to hold session state and RBAC permissions on frontend
- Ensure state updates reactively control UI visibility tied to roles
- On backend, encapsulate roles/permissions logic within services to enforce access

### Real-time Features
- Use FastAPI WebSocket support for real-time chat or notifications if required
- Alternatively, integrate external realtime services (Pusher, Firebase) depending on scale
- Manage presence and message delivery via backend or external service APIs

### File Upload System
- Handle signed image/file uploads securely via FastAPI endpoints
- Use Cloudinary or S3 for storage with image transformation capabilities
- Implement admin moderation pipeline for uploaded content

### Testing
- **Frontend**: Use Jest + React Testing Library for UI and component tests
- **Backend**: Use Pytest with test MongoDB instance for API and service layer testing
- Include RBAC tests for frontend visibility and backend permission enforcement
- Maintain good coverage for authentication, validation, error handling

## Key Patterns

### Dynamic RBAC Implementation
- Centralize RBAC logic on backend, exposing user roles and permissions via API
- Middleware validates tokens and enforces permissions per endpoint
- Frontend retrieves RBAC metadata on login; components use hooks/contexts to conditionally render
- Allow permissions granularity: view, edit, delete, admin-level controls
- Provide admin UI or config file to manage roles and associated permissions dynamically

### Server Actions (Backend API Endpoints)
- Use FastAPI async path operations in `/app/api/` for data mutations
- Validate request data with Pydantic models
- Return consistent response models with status and error info
- Enforce authentication and dynamic RBAC checks on all sensitive endpoints

### Route Protection (Frontend)
- Use React Router guards or private routes checking auth and RBAC state
- Redirect unauthorized users to login or error pages
- Dynamically hide/show menu items and actions based on current user's permissions

### Form Handling
- Use React Hook Form with Zod or Yup schema validation
- Show user-friendly validation error messages
- Validate both client-side and server-side for security

### Image Management
- Upload images through signed URLs or secure backend endpoints
- Store metadata in MongoDB with approval states
- Use Cloudinary/S3 transformations for optimized delivery

### Error Handling
- Use React Error Boundaries to catch UI errors safely
- On backend, catch exceptions and return structured error responses
- Log errors with monitoring tools (Sentry, LogRocket)

## Visual Development & Testing

### Design System
- Use Tailwind CSS as utility-first styling
- Leverage component libraries like Radix UI or Material UI for accessible components
- Follow accessibility standards (WCAG 2.1 AA)
- Ensure responsive and polished UI with mobile-first design

### Quick Visual Check
After any frontend change:
1. Identify what changed
2. Navigate affected pages
3. Verify design matches requirements and style guide
4. Capture screenshots
5. Check console for errors

### Automated UI Testing
- Use React Testing Library and Jest for unit and integration tests
- Use Cypress or Playwright for end-to-end testing workflows including auth and RBAC tests

## Environment Setup

Requires environment variables:
- `VITE_API_URL` - Backend API base URL
- `MONGO_URI` - MongoDB connection string
- `SECRET_KEY` - JWT signing secret
- `CLOUDINARY_URL` or S3 keys - For image storage
- Email provider keys for verification and notifications

## Additional Context
- Documentation and config files for managing roles and permissions
- RBAC admin UI or config standardization documents
- Code style and linting configurations for consistent quality
