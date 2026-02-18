# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Install Dependencies
```bash
npm install
```

### 2. Build Shared Contracts
```bash
npm run build:contracts
```

### 3. Set Up Environment Files

Backend:
```bash
cd backend
# The .env file is already created with default values
# For production, update MONGODB_URI and JWT_SECRET
```

Frontend:
```bash
cd frontend
# The .env file is already created with default values
```

### 4. Start MongoDB

**Option A: Local MongoDB**
```bash
mongod
```

**Option B: Docker**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

**Option C: MongoDB Atlas**
- Create a free cluster at https://www.mongodb.com/atlas
- Get connection string
- Update `backend/.env` with your connection string

### 5. Run the Application

**Run both frontend and backend together:**
```bash
npm run dev
```

**OR run separately:**

Terminal 1 - Backend:
```bash
npm run dev:backend
```

Terminal 2 - Frontend:
```bash
npm run dev:frontend
```

### 6. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **API Docs**: http://localhost:5000/api/docs

### 7. Create Your First Account

1. Go to http://localhost:5173
2. Click "Sign Up"
3. Fill in your details
4. You'll be redirected to the dashboard
5. Click "Create Task" to get started!

---

## 🧪 Test Features

### Test Conflict Detection
1. Create a task for tomorrow at 2:00 PM
2. Create another task at the same time
3. See the conflict modal in action

### Test Smart Reminders
1. Create a task with reminders enabled
2. Check the backend terminal logs
3. You'll see reminder notifications every 5 minutes

### Test Priority & Filters
1. Create tasks with different priorities
2. Use the filter dropdowns on the dashboard
3. Update task status (for duration tasks)

---

## 📚 Next Steps

- Read the full [README.md](./README.md) for detailed documentation
- Explore the API docs at http://localhost:5000/api/docs
- Check out the code structure in `/backend/src` and `/frontend/src`
- Review typed contracts in `/packages/contracts/src`

---

## 🐛 Troubleshooting

**MongoDB Connection Error:**
- Ensure MongoDB is running: `mongod` or check your Docker container
- Verify `MONGODB_URI` in `backend/.env`

**Port Already in Use:**
- Change `PORT` in `backend/.env` (backend)
- Change port in `frontend/vite.config.ts` (frontend)

**Build Errors:**
- Run `npm run build:contracts` first
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`

**Frontend API Errors:**
- Ensure backend is running
- Check `VITE_API_URL` in `frontend/.env`
- Verify CORS settings in `backend/.env`

---

Happy coding! 🎉
