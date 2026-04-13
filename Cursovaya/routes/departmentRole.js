import { Router } from 'express';
const router = Router();
import Validator from '../utils/validator.js';
import knex from '../db.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';

// GET /department/groups - получение всех групп отделения (для главы отделения)
router.get('/department/groups', authMiddleware, roleMiddleware(['department']), async (req, res) => {
    try {
        const userId = req.user.user_id; // ID текущего авторизованного пользователя
        
        // Получаем отделение, которым руководит пользователь
        const department = await knex('departments')
            .where('user_id', userId)
            .first();
        
        if (!department) {
            return res.status(404).json({ error: 'Отделение не найдено для текущего пользователя' });
        }
        
        // Получаем все группы этого отделения
        const groups = await knex('groups')
            .select(
                'groups.*',
                'users.login as teacher_login',
                'users.fio as teacher_fio'
            )
            .leftJoin('users', 'groups.user_id', 'users.user_id')
            .where('groups.department_id', department.department_id)
            .orderBy('groups.group_name');
        
        // Для каждой группы получаем количество студентов
        for (let group of groups) {
            const studentsCount = await knex('students')
                .where('group_id', group.group_id)
                .count('student_id as count')
                .first();
            group.students_count = parseInt(studentsCount.count) || 0;
        }
        
        res.json({
            department: {
                id: department.department_id,
                name: department.department_name
            },
            groups: groups,
            total: groups.length
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: `Ошибка получения групп отделения: ${error.message}` });
    }
});

// GET /department/groups/:groupId - получение конкретной группы со студентами (для главы отделения)
router.get('/department/groups/:groupId', authMiddleware, roleMiddleware(['department']), async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { groupId } = req.params;
        
        // Получаем отделение текущего пользователя
        const department = await knex('departments')
            .where('user_id', userId)
            .first();
        
        if (!department) {
            return res.status(404).json({ error: 'Отделение не найдено для текущего пользователя' });
        }
        
        // Получаем группу и проверяем, что она принадлежит отделению пользователя
        const group = await knex('groups')
            .select(
                'groups.*',
                'users.login as teacher_login',
                'users.fio as teacher_fio',
                'departments.department_name'
            )
            .leftJoin('users', 'groups.user_id', 'users.user_id')
            .leftJoin('departments', 'groups.department_id', 'departments.department_id')
            .where('groups.group_id', groupId)
            .where('groups.department_id', department.department_id)
            .first();
        
        if (!group) {
            return res.status(404).json({ 
                error: 'Группа не найдена или не принадлежит вашему отделению' 
            });
        }
        
        // Получаем всех студентов группы
        const students = await knex('students')
            .where('group_id', groupId)
            .orderBy('fio');
        
        // Дополнительная информация: статистика группы
        const stats = {
            total_students: students.length,
            // можно добавить другую статистику, например:
            // average_grade: await getAverageGrade(groupId),
            // attendance_rate: await getAttendanceRate(groupId)
        };
        
        res.json({
            group: group,
            students: students,
            statistics: stats
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: `Ошибка получения группы: ${error.message}` });
    }
});

// GET /department/groups/:groupId/students - получение студентов конкретной группы (для главы отделения)
router.get('/department/groups/:groupId/students', authMiddleware, roleMiddleware(['department']), async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { groupId } = req.params;
        
        // Получаем отделение текущего пользователя
        const department = await knex('departments')
            .where('user_id', userId)
            .first();
        
        if (!department) {
            return res.status(404).json({ error: 'Отделение не найдено для текущего пользователя' });
        }
        
        // Проверяем, что группа принадлежит отделению
        const group = await knex('groups')
            .where('group_id', groupId)
            .where('department_id', department.department_id)
            .first();
        
        if (!group) {
            return res.status(404).json({ 
                error: 'Группа не найдена или не принадлежит вашему отделению' 
            });
        }
        
        // Получаем студентов с возможностью пагинации и поиска
        const { page = 1, limit = 20, search = '' } = req.query;
        const offset = (page - 1) * limit;
        
        let query = knex('students').where('group_id', groupId);
        
        if (search) {
            query = query.where('fio', 'ilike', `%${search}%`);
        }
        
        const students = await query
            .orderBy('fio')
            .limit(limit)
            .offset(offset);
        
        const totalCount = await knex('students')
            .where('group_id', groupId)
            .modify((qb) => {
                if (search) {
                    qb.where('fio', 'ilike', `%${search}%`);
                }
            })
            .count('student_id as count')
            .first();
        
        res.json({
            group: {
                id: group.group_id,
                name: group.group_name
            },
            students: students,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(totalCount.count),
                pages: Math.ceil(totalCount.count / limit)
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: `Ошибка получения студентов: ${error.message}` });
    }
});

// GET /department/students - получение всех студентов всех групп отделения (для главы отделения)
router.get('/department/students', authMiddleware, roleMiddleware(['department']), async (req, res) => {
    try {
        const userId = req.user.user_id;
        
        // Получаем отделение текущего пользователя
        const department = await knex('departments')
            .where('user_id', userId)
            .first();
        
        if (!department) {
            return res.status(404).json({ error: 'Отделение не найдено для текущего пользователя' });
        }
        
        // Получаем все группы отделения
        const groups = await knex('groups')
            .where('department_id', department.department_id)
            .select('group_id');
        
        const groupIds = groups.map(g => g.group_id);
        
        if (groupIds.length === 0) {
            return res.json({
                department: department.department_name,
                students: [],
                total: 0
            });
        }
        
        // Получаем всех студентов из этих групп
        const students = await knex('students')
            .select(
                'students.*',
                'groups.group_name'
            )
            .leftJoin('groups', 'students.group_id', 'groups.group_id')
            .whereIn('students.group_id', groupIds)
            .orderBy('groups.group_name')
            .orderBy('students.fio');
        
        // Группируем студентов по группам
        const studentsByGroup = {};
        students.forEach(student => {
            if (!studentsByGroup[student.group_name]) {
                studentsByGroup[student.group_name] = [];
            }
            studentsByGroup[student.group_name].push(student);
        });
        
        res.json({
            department: {
                id: department.department_id,
                name: department.department_name
            },
            groups_count: groups.length,
            total_students: students.length,
            students_by_group: studentsByGroup,
            all_students: students
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: `Ошибка получения студентов: ${error.message}` });
    }
});



export default router;