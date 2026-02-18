# 🚀 Smart Task Management Application

A **production-ready**, full-stack task management system with intelligent conflict detection, smart reminders, and strict type safety. Built with **React**, **TypeScript**, **Node.js**, **Express**, and **MongoDB**.

---

## 🌟 Key Features

### Core Functionality
- ✅ **Secure Authentication** - JWT-based auth with bcrypt password hashing
- ✅ **Two Task Types**:
  - **Reminder Tasks** - Point-in-time events (meetings, calls)
  - **Duration Tasks** - Long-term tasks with deadlines and status tracking
- ✅ **Priority Management** - Low, Medium, High priority levels
- ✅ **Conflict Detection** - Automatic detection of scheduling overlaps with user override
- ✅ **Smart Reminders** - Quarter-based notifications (75%, 50%, 25%, at-time)
- ✅ **Status Lifecycle** - Pending → In Progress → Completed (for duration tasks)
- ✅ **Responsive UI** - Clean, modern interface with TailwindCSS

### Technical Highlights
- 🎯 **Shared Type Contracts** - Single source of truth for types across frontend & backend
- 🔒 **Strict Type Safety** - No `any` types, full TypeScript coverage
- 📚 **Interactive API Docs** - Swagger/OpenAPI documentation at `/api/docs`
- 🧪 **Zod Validation** - Runtime validation with type inference
- ⚡ **React Query** - Optimistic updates and caching
- 🏗️ **Clean Architecture** - Layered backend (routes → controllers → services)
- 🌍 **Environment Flexibility** - Works with local MongoDB and MongoDB Atlas

---

## 📁 Project Structure

```
smart-task-management/
├── packages/
│   └── contracts/              # Shared TypeScript types and Zod schemas
│       ├── src/
│       │   ├── auth.ts         # Auth DTOs and schemas
│       │   ├── user.ts         # User models
│       │   ├── task.ts         # Task models and schemas
│       │   └── common.ts       # Shared enums and types
│       └── package.json
├── backend/
│   ├── src/
│   │   ├── config/             # Database and Swagger configuration
│   │   ├── controllers/        # Request handlers
│   │   ├── middleware/         # Auth, validation, error handling
│   │   ├── models/             # MongoDB schemas
│   │   ├── routes/             # API routes
│   │   ├── services/           # Business logic
│   │   │   ├── auth.service.ts
│   │   │   ├── task.service.ts
│   │   │   └── reminder.service.ts
│   │   └── server.ts           # Express app entry point
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/                # API client functions
│   │   ├── components/         # React components
│   │   │   ├── TaskCard.tsx
│   │   │   ├── TaskForm.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   ├── context/            # React context (Auth)
│   │   ├── lib/                # Axios config
│   │   ├── pages/              # Page components
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   └── DashboardPage.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
└── package.json                # Root workspace config
```

---

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript
- **TanStack Query** (React Query) for data fetching
- **React Router v6** for routing
- **Axios** with interceptors for API calls
- **TailwindCSS** for styling
- **Vite** for build tooling
- **date-fns** for date formatting
- **react-hot-toast** for notifications

### Backend
- **Node.js** with Express
- **TypeScript** (strict mode)
- **MongoDB** with Mongoose
- **JWT** authentication
- **bcryptjs** for password hashing
- **Zod** for validation
- **Swagger/OpenAPI** for documentation
- **node-cron** for reminder scheduling
- **helmet** and **cors** for security

### Shared
- **TypeScript** for end-to-end type safety
- **Zod** schemas for runtime validation

---

## ⚙️ Setup Instructions

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0
- MongoDB (local or Atlas)

### 1. Clone and Install

```bash
cd smart-task-management
npm install
```

This installs dependencies for all workspaces (root, contracts, backend, frontend).

### 2. Configure Backend Environment

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
NODE_ENV=development
PORT=5000

# For local development:
MONGODB_URI=mongodb://localhost:27017/smart-task-management

# For MongoDB Atlas (production):
# MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/smart-task-management?retryWrites=true&w=majority

JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

CORS_ORIGIN=http://localhost:5173
API_PREFIX=/api
```

**⚠️ IMPORTANT**: Change `JWT_SECRET` to a strong random string in production!

### 3. Configure Frontend Environment

```bash
cd frontend
cp .env.example .env
```

Edit `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

### 4. Start MongoDB (if using local)

```bash
# Using MongoDB installed locally
mongod

# OR using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 5. Build Shared Contracts

```bash
npm run build:contracts
```

### 6. Run the Application

**Option A: Run Both Servers Concurrently**
```bash
npm run dev
```

**Option B: Run Separately**

Terminal 1 (Backend):
```bash
npm run dev:backend
```

Terminal 2 (Frontend):
```bash
npm run dev:frontend
```

### 7. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **API Documentation**: http://localhost:5000/api/docs

---

## 🎯 Usage Guide

### 1. Register/Login
1. Navigate to http://localhost:5173
2. Click "Sign Up" or "Sign In"
3. Create an account or login

### 2. Create a Task

**Reminder Task (Short Task)**
- Click "Create Task"
- Select "⏰ Reminder Task"
- Enter title, priority, start date/time
- Optionally enable reminders
- Click "Create Task"

**Duration Task (Long Task)**
- Click "Create Task"
- Select "📋 Duration Task"
- Enter title, priority, start date/time, and deadline
- Set initial status (Pending/In Progress/Completed)
- Optionally enable reminders
- Click "Create Task"

### 3. Handle Conflicts

If you create a task that overlaps with existing tasks:
1. A **conflict alert** will appear
2. You can choose to:
   - **Reschedule** - Adjust the time
   - **Continue Anyway** - Create despite the conflict

### 4. Manage Tasks

- **Update Status**: Click status buttons on duration task cards
- **Filter**: Use dropdowns to filter by type, priority, or status
- **Delete**: Click "Delete" on any task card
- **View Details**: All task information is displayed on the card

### 5. Smart Reminders

Reminders are sent automatically at:
- **Reminder Tasks**: 75%, 50%, 25% before start time, and at start time
- **Duration Tasks**: 75%, 50%, 25% before deadline, and at deadline

Reminders stop when a task is completed.

---

## 🧠 Architecture Decisions

### 1. Monorepo with Shared Contracts
**Why**: Ensures type safety across frontend and backend. Changes to data models automatically propagate, preventing API shape mismatches.

### 2. Conflict Detection Logic
**Implementation**:
- Reminder ↔ Reminder: Same start time = conflict
- Reminder ↔ Duration: Reminder start within duration range = conflict
- Duration ↔ Duration: Overlapping time ranges = conflict

**User Experience**: Non-blocking. Users can override conflicts with explicit confirmation.

### 3. Smart Reminder System
**Quarter-Based Approach**:
- **Reminder Tasks**: Quarters calculated from creation time to start time
- **Duration Tasks**: Quarters calculated from creation time to deadline
- Prevents spam by tracking sent reminders in database

**Implementation**: Cron job runs every 5 minutes, checks eligible tasks, sends reminders.

### 4. Clean Backend Architecture
```
Routes → Controllers → Services → Models
```
- **Routes**: Define endpoints and apply middleware
- **Controllers**: Handle HTTP requests/responses
- **Services**: Contain business logic (reusable, testable)
- **Models**: MongoDB schemas

### 5. React Query for State Management
**Benefits**:
- Automatic caching and refetching
- Optimistic updates
- Loading and error states handled gracefully
- No need for Redux for this use case

---

## 🔒 Security Features

1. **Password Security**: bcrypt with 12 rounds
2. **JWT Authentication**: Secure token-based auth
3. **Protected Routes**: All task APIs require authentication
4. **CORS**: Configured for specific origins
5. **Helmet**: Security headers
6. **User-Scoped Data**: Tasks only accessible by owning user
7. **Validation**: Zod schemas on both frontend and backend

---

## 🌍 Production Deployment

### Backend (MongoDB Atlas)

1. Create MongoDB Atlas cluster
2. Get connection string
3. Update `backend/.env`:
   ```env
   NODE_ENV=production
   MONGODB_URI=mongodb+srv://...
   JWT_SECRET=<strong-random-secret>
   CORS_ORIGIN=https://your-frontend-domain.com
   ```
4. Deploy to **Heroku**, **Railway**, **Render**, or **AWS**

### Frontend

1. Update `frontend/.env`:
   ```env
   VITE_API_URL=https://your-backend-api.com/api
   ```
2. Build:
   ```bash
   npm run build --workspace=frontend
   ```
3. Deploy `frontend/dist` to **Vercel**, **Netlify**, or **Cloudflare Pages**

---

## 📚 API Documentation

Interactive API documentation is available at:
```
http://localhost:5000/api/docs
```

### Key Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

#### Tasks (Requires Auth)
- `GET /api/tasks` - Get all tasks (with filters)
- `POST /api/tasks` - Create new task
- `GET /api/tasks/:id` - Get task by ID
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `POST /api/tasks/check-conflict` - Check for conflicts

---

## 🎓 Known Limitations & Future Enhancements

### Current Limitations
1. Reminders are console-logged (not sent via email/SMS)
2. No task edit form (update status only)
3. No pagination on task list (suitable for <1000 tasks)
4. No recurring tasks
5. No task sharing between users

### Future Enhancements
- Email/SMS notification integration
- Full task edit modal
- Drag-and-drop calendar view
- Task tags and categories
- Team collaboration features
- Mobile app (React Native)
- Real-time updates (WebSockets)
- Advanced analytics dashboard

---

## 🧪 Testing the System

### Test Conflict Detection

1. Create a reminder task for tomorrow at 2:00 PM
2. Try creating another task with overlapping time
3. Verify conflict modal appears
4. Test both "Reschedule" and "Continue Anyway" options

### Test Smart Reminders

1. Create tasks with reminders enabled
2. Check backend console every 5 minutes
3. Verify reminders are logged at appropriate quarters

### Test Priority & Status

1. Create tasks with different priorities
2. Verify visual indicators (colors, badges)
3. Update duration task status
4. Verify completed tasks stop receiving reminders

---

## 📝 Git Commit Guidelines

This project follows conventional commits:

```bash
feat: add conflict override functionality
fix: resolve reminder scheduling bug
docs: update README with deployment instructions
refactor: improve task service architecture
```

---

## 👨‍💻 Developer Notes

### Running Individual Workspaces

```bash
# Build contracts
npm run build --workspace=@smart-task/contracts

# Run backend
npm run dev --workspace=backend

# Run frontend
npm run dev --workspace=frontend
```

### Adding New Features

1. Update shared contracts in `packages/contracts/src/`
2. Rebuild contracts: `npm run build:contracts`
3. Implement backend logic in services
4. Add API endpoints in controllers/routes
5. Update Swagger docs
6. Implement frontend UI
7. Test end-to-end

---

## 📧 Support

For issues or questions, please create an issue in the repository.

---

## License

MIT License - Feel free to use this project for learning or production purposes.

---

**Built with ❤️ as a demonstration of production-ready full-stack development.**
