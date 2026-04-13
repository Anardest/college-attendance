import { Router } from 'express';
const router = Router();
import Validator from '../utils/validator.js';
import knex from '../db.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';

// GET /teacher/group - получение своей группы и всех студентов (для преподавателя)
router.get('/teacher/group', authMiddleware, roleMiddleware(['teacher']), async (req, res) => {
    try {
        const userId = req.user.user_id; // ID текущего авторизованного преподавателя
        
        // Получаем группу, где преподаватель является руководителем
        const group = await knex('groups')
            .select(
                'groups.*',
                'departments.department_name',
                'departments.department_id'
            )
            .leftJoin('departments', 'groups.department_id', 'departments.department_id')
            .where('groups.user_id', userId)
            .first();
        
        if (!group) {
            return res.status(404).json({ 
                error: 'Группа не найдена. Вы не назначены руководителем ни одной группы.' 
            });
        }
        
        // Получаем всех студентов группы
        const students = await knex('students')
            .where('group_id', group.group_id)
            .orderBy('fio');
        
        // Дополнительная статистика по группе
        const stats = {
            total_students: students.length,
            // Можно добавить другие метрики:
            // attendance_today: await getTodayAttendance(group.group_id),
            // average_performance: await getAveragePerformance(group.group_id)
        };
        
        // Получаем информацию о самом преподавателе
        const teacher = await knex('users')
            .select('user_id', 'login', 'fio', 'role')
            .where('user_id', userId)
            .first();
        
        res.json({
            teacher: {
                id: teacher.id,
                fio: teacher.fio,
                login: teacher.login
            },
            group: {
                id: group.group_id,
                name: group.group_name,
                department_id: group.department_id,
                department_name: group.department_name
            },
            students: students,
            statistics: stats
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: `Ошибка получения данных группы: ${error.message}` });
    }
});

export default router;