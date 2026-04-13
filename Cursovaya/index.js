import express from 'express';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import db from './db.js';
import { authMiddleware, roleMiddleware, SECRET } from './middleware/auth.js';
import morgan from 'morgan';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(bodyParser.json());
app.use(morgan('dev'));

// Настройка CORS
const corsOptions = {
  origin: 'http://localhost:3001',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// =========================
// AUTH
// =========================
app.post('/api/login', async (req, res) => {
    const { login, password } = req.body;
    
    try {
        // Получаем пользователя из базы данных
        const user = await db('users').where({ login, password }).first();
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Используем jwt.sign
        const token = jwt.sign(
            { 
                user_id: user.user_id, 
                login: user.login, 
                role: user.role
            }, 
            SECRET, 
            { expiresIn: '24h' }
        );
        
        // Возвращаем токен и роль
        res.json({ 
            token,
            user_id: user.user_id,
            role: user.role,
            login: user.login 
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =========================
// USER INFO (получить информацию о текущем пользователе)
// =========================
app.get('/api/user-info', authMiddleware, (req, res) => {
    // Просто возвращаем данные из токена
    res.json({
        user_id: req.user.user_id,
        login: req.user.login,
        role: req.user.role
    });
});

function pageRoleMiddleware(roles = []) {
    return (req, res, next) => {
        const user = req.user;

        if (!user || !roles.includes(user.role)) {
            return res.sendFile(join(__dirname, 'public/403.html'));
        }

        next();
    };
}

// =========================
// USERS (admin only)
// =========================
import usersRouter from './routes/users.js';
app.use('/api/', usersRouter);

// =========================
// DEPARTMENTS
// =========================
import departmentsRouter from './routes/departments.js';
app.use('/api/', departmentsRouter);

// =========================
// DEPARTMENTS (ONLY)
// =========================
import departmentsRoleRouter from './routes/departmentRole.js';
app.use('/api/', departmentsRoleRouter);


// =========================
// GROUPS
// =========================
import groupsRouter from './routes/groups.js';
app.use('/api/', groupsRouter);

// =========================
// ATTENDANCE
// =========================
import attendanceRouter from './routes/attendance.js';
app.use('/api/', attendanceRouter);

// =========================
// REPORTS
// =========================
import reportsRouter from './routes/report.js';
app.use('/api/', reportsRouter);

// =========================
// TEACHERS
// =========================
import teacherRouter from './routes/teacherRole.js';
app.use('/api/', teacherRouter);

// =========================
// STATIC FILES 
// =========================
app.get('/login', (req, res) => {
    res.sendFile(join(__dirname, 'public/login.html'));
});

app.get('/menu', (req, res) => {
    res.sendFile(join(__dirname, 'public/menu.html'));
});

// =========================
// STATIC FILES (ADMIN)
// =========================
app.get('/admin/users', (req, res) => {
    res.sendFile(join(__dirname, 'public/users.html'));
});

app.get('/admin/departments', (req, res) => {
    res.sendFile(join(__dirname, 'public/departments.html'));
});

app.get('/admin/groups', (req, res) => {
    res.sendFile(join(__dirname, 'public/groups.html'));
});

app.get('/admin/groups/:id', (req, res) => {
    res.sendFile(join(__dirname, 'public/groupDetail.html'));
});

app.get('/admin/attendance', (req, res) => {
    res.sendFile(join(__dirname, 'public/attendance.html'));
});

app.get('/admin/reports', (req, res) => {
    res.sendFile(join(__dirname, 'public/reports.html'));
});

// =========================
// STATIC FILES (DEPARTMENT)
// =========================
app.get('/department/info', (req, res) => {
    res.sendFile(join(__dirname, 'public/departmentInfo.html'));
});

app.get('/department/reports', (req, res) => {
    res.sendFile(join(__dirname, 'public/departmentReports.html'));
});

// =========================
// STATIC FILES (TEACHER)
// =========================
app.get('/teacher/reports', (req, res) => {
    res.sendFile(join(__dirname, 'public/teacherReports.html'));
});

app.get('/teacher/info', (req, res) => {
    res.sendFile(join(__dirname, 'public/teacherMyGroup.html'));
});

// Serve static files from public directory
app.use(express.static(join(__dirname, 'public')));


// import createTables from './create_db.js';
// await createTables();


// =========================
// 404
// =========================
app.use((req, res) => {
    res.sendFile(join(__dirname, 'public/404.html'));
});


// =========================
// START SERVER
// =========================
app.listen(3001, () => console.log('Server running on port 3001'));