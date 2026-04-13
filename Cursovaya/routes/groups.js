import { Router } from 'express';
const router = Router();
import Validator from '../utils/validator.js';
import knex from '../db.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';

// GET /groups - получение всех групп
router.get('/groups', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const groups = await knex('groups')
            .select(
                'groups.*',
                'users.login as teacher_login',
                'users.fio as teacher_fio',
                'departments.department_name'
            )
            .leftJoin('users', 'groups.user_id', 'users.user_id')
            .leftJoin('departments', 'groups.department_id', 'departments.department_id');
        
        res.json(groups);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка получения групп' });
    }
});

// GET /groups/:id - получение группы по ID
router.get('/groups/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        
        const group = await knex('groups')
            .select(
                'groups.*',
                'users.login as teacher_login',
                'users.fio as teacher_fio',
                'departments.department_name'
            )
            .leftJoin('users', 'groups.user_id', 'users.user_id')
            .leftJoin('departments', 'groups.department_id', 'departments.department_id')
            .where('groups.group_id', id)
            .first();
        
        if (!group) {
            return res.status(404).json({ error: 'Группа не найдена' });
        }
        
        // Получаем студентов группы
        const students = await knex('students')
            .where('group_id', id);
        
        res.json({ ...group, students });
    } catch (error) {
        res.status(500).json({ error: `Ошибка получения группы: ${error.message}` });
    }
});

// POST /groups - создание группы
router.post('/groups', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const { user_id, group_name, department_id } = req.body;
        console.log(user_id, group_name, department_id);
        
        // Проверяем обязательные поля
        if (!group_name || !Validator.isString(group_name)) {
            throw new Error('Название группы обязательно');
        }
        
        if (!department_id) {
            throw new Error('ID отделения обязателен');
        }
        
        // Проверяем существование отделения
        const department = await knex('departments').where('department_id', department_id).first();
        if (!department) {
            return res.status(404).json({ error: 'Отделение не найдено' });
        }
        
        // Проверяем преподавателя (если указан)
        if (user_id) {
            const user = await knex('users').where('user_id', user_id).first();
            if (!user) {
                return res.status(404).json({ error: 'Пользователь не найден' });
            }
            if (user.role !== 'teacher') {
                return res.status(400).json({ error: 'Пользователь должен иметь роль "teacher"' });
            }
        }
        
        const group = await knex('groups')
            .insert({
                user_id: user_id || null,
                group_name: group_name,
                department_id: department_id
            })
            .returning('*');
        
        res.json(group[0]);
    } catch (error) {
        res.status(500).json({ error: `Ошибка создания группы: ${error.message}` });
    }
});

// PATCH /groups/:id - обновление группы
router.patch('/groups/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id, group_name, department_id } = req.body;
        
        // Проверяем, существует ли группа
        const existingGroup = await knex('groups').where('group_id', id).first();
        if (!existingGroup) {
            return res.status(404).json({ error: 'Группа не найдена' });
        }
        
        // Подготавливаем данные для обновления
        const updateData = {};
        
        if (group_name !== undefined) {
            if (!Validator.isString(group_name)) {
                throw new Error('Неверный формат названия группы');
            }
            updateData.group_name = group_name;
        }
        
        if (department_id !== undefined) {
            const department = await knex('departments').where('department_id', department_id).first();
            if (!department) {
                return res.status(404).json({ error: 'Отделение не найдено' });
            }
            updateData.department_id = department_id;
        }
        
        if (user_id !== undefined) {
            if (user_id === null) {
                updateData.user_id = null;
            } else {
                const user = await knex('users').where('user_id', user_id).first();
                if (!user) {
                    return res.status(404).json({ error: 'Пользователь не найден' });
                }
                if (user.role !== 'teacher') {
                    return res.status(400).json({ error: 'Пользователь должен иметь роль "teacher"' });
                }
                updateData.user_id = user_id;
            }
        }
        
        // Если нет данных для обновления
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'Нет данных для обновления' });
        }
        
        // Обновляем группу
        const updatedGroup = await knex('groups')
            .where('group_id', id)
            .update(updateData)
            .returning('*');
        
        res.json(updatedGroup[0]);
    } catch (error) {
        res.status(500).json({ error: `Ошибка обновления группы: ${error.message}` });
    }
});

// DELETE /groups/:id - удаление группы с проверкой студентов
router.delete('/groups/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        
        // Проверяем, существует ли группа
        const existingGroup = await knex('groups').where('group_id', id).first();
        if (!existingGroup) {
            return res.status(404).json({ error: 'Группа не найдена' });
        }
        
        // Проверяем, есть ли в группе студенты
        const students = await knex('students').where('group_id', id);
        if (students.length > 0) {
            return res.status(409).json({
                error: 'Нельзя удалить группу, так как в ней есть студенты',
                studentsCount: students.length,
                students: students.map(s => ({ id: s.student_id, fio: s.fio })),
                suggestion: 'Сначала удалите или переведите всех студентов из этой группы'
            });
        }
        
        // Удаляем группу
        const deletedGroup = await knex('groups')
            .where('group_id', id)
            .del()
            .returning('*');
        
        res.json({
            message: 'Группа успешно удалена',
            deletedGroup: deletedGroup[0]
        });
    } catch (error) {
        res.status(500).json({ error: `Ошибка удаления группы: ${error.message}` });
    }
});

// GET /groups/:groupId/students - получение всех студентов группы
router.get('/groups/:groupId/students', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const { groupId } = req.params;
        
        // Проверяем существование группы
        const group = await knex('groups').where('group_id', groupId).first();
        if (!group) {
            return res.status(404).json({ error: 'Группа не найдена' });
        }
        
        const students = await knex('students')
            .where('group_id', groupId);
        
        res.json(students);
    } catch (error) {
        res.status(500).json({ error: `Ошибка получения студентов: ${error.message}` });
    }
});

// POST /groups/:groupId/students - добавление студента в группу
router.post('/groups/:groupId/students', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const { groupId } = req.params;
        const { fio } = req.body;
        
        // Проверяем обязательные поля
        if (!fio || !Validator.isString(fio)) {
            throw new Error('ФИО студента обязательно');
        }
        
        // Проверяем существование группы
        const group = await knex('groups').where('group_id', groupId).first();
        if (!group) {
            return res.status(404).json({ error: 'Группа не найдена' });
        }
        
        // Разбиваем ФИО для валидации
        const [surname, name, patronymic] = fio.split(' ');
        if (!Validator.isString(surname) || !Validator.isString(name)) {
            throw new Error('Неверный формат ФИО');
        }
        
        // Добавляем студента
        const student = await knex('students')
            .insert({
                group_id: groupId,
                fio: fio
            })
            .returning('*');
        
        res.json(student[0]);
    } catch (error) {
        res.status(500).json({ error: `Ошибка добавления студента: ${error.message}` });
    }
});

// PATCH /students/:studentId - редактирование студента
router.patch('/students/:studentId', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const { studentId } = req.params;
        const { fio, group_id } = req.body;
        
        // Проверяем, существует ли студент
        const existingStudent = await knex('students').where('student_id', studentId).first();
        if (!existingStudent) {
            return res.status(404).json({ error: 'Студент не найден' });
        }
        
        // Подготавливаем данные для обновления
        const updateData = {};
        
        if (fio !== undefined) {
            const [surname, name, patronymic] = fio.split(' ');
            if (!Validator.isString(surname) || !Validator.isString(name)) {
                throw new Error('Неверный формат ФИО');
            }
            updateData.fio = fio;
        }
        
        if (group_id !== undefined) {
            // Проверяем существование новой группы
            const group = await knex('groups').where('group_id', group_id).first();
            if (!group) {
                return res.status(404).json({ error: 'Группа не найдена' });
            }
            updateData.group_id = group_id;
        }
        
        // Если нет данных для обновления
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'Нет данных для обновления' });
        }
        
        // Обновляем студента
        const updatedStudent = await knex('students')
            .where('student_id', studentId)
            .update(updateData)
            .returning('*');
        
        res.json(updatedStudent[0]);
    } catch (error) {
        res.status(500).json({ error: `Ошибка обновления студента: ${error.message}` });
    }
});

// DELETE /students/:studentId - удаление студента
router.delete('/students/:studentId', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const { studentId } = req.params;
        
        // Проверяем, существует ли студент
        const existingStudent = await knex('students').where('student_id', studentId).first();
        if (!existingStudent) {
            return res.status(404).json({ error: 'Студент не найден' });
        }
        
        // Удаляем студента
        const deletedStudent = await knex('students')
            .where('student_id', studentId)
            .del()
            .returning('*');
        
        res.json({
            message: 'Студент успешно удалён',
            deletedStudent: deletedStudent[0]
        });
    } catch (error) {
        res.status(500).json({ error: `Ошибка удаления студента: ${error.message}` });
    }
});

export default router;

