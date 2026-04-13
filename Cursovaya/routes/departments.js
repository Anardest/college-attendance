import { Router } from 'express';
const router = Router();
import Validator from '../utils/validator.js';
import knex from '../db.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';

// GET /departments - получение всех отделений
router.get('/departments', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const departments = await knex('departments')
            .select('departments.*', 'users.login', 'users.fio')
            .leftJoin('users', 'departments.user_id', 'users.user_id');
        res.json(departments);
    } catch (error) {
        res.status(500).json({ error: `Ошибка создания отделения: ${error.message}` });
    }
});

// POST /departments - создание отделения
router.post('/departments', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const { user_id, department_name } = req.body;
        
        // Проверяем обязательные поля
        if (!department_name || !Validator.isString(department_name)) {
            throw new Error('Название отделения обязательно');
        }
        
        // Проверяем существование пользователя и его роль
        if (user_id) {
            const user = await knex('users').where('user_id', user_id).first();
            if (!user) {
                return res.status(404).json({ error: 'Пользователь не найден' });
            }
            if (user.role !== 'department') {
                return res.status(400).json({ error: 'Пользователь должен иметь роль "department"' });
            }
        }
        
        const department = await knex('departments')
            .insert({
                user_id: user_id || null,
                department_name: department_name
            })
            .returning('*');
        
        res.json(department[0]);
    } catch (error) {
        res.status(500).json({ error: `Ошибка создания отделения: ${error.message}` });
    }
});

// PATCH /departments/:id - обновление отделения
router.patch('/departments/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id, department_name } = req.body;
        
        // Проверяем, существует ли отделение
        const existingDepartment = await knex('departments').where('department_id', id).first();
        if (!existingDepartment) {
            return res.status(404).json({ error: 'Отделение не найдено' });
        }
        
        // Подготавливаем данные для обновления
        const updateData = {};
        
        if (department_name !== undefined) {
            if (!Validator.isString(department_name)) {
                throw new Error('Неверный формат названия отделения');
            }
            updateData.department_name = department_name;
        }
        
        if (user_id !== undefined) {
            if (user_id === null) {
                updateData.user_id = null;
            } else {
                // Проверяем существование пользователя и его роль
                const user = await knex('users').where('user_id', user_id).first();
                if (!user) {
                    return res.status(404).json({ error: 'Пользователь не найден' });
                }
                if (user.role !== 'department') {
                    return res.status(400).json({ error: 'Пользователь должен иметь роль "department"' });
                }
                updateData.user_id = user_id;
            }
        }
        
        // Если нет данных для обновления
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'Нет данных для обновления' });
        }
        
        // Обновляем отделение
        const updatedDepartment = await knex('departments')
            .where('department_id', id)
            .update(updateData)
            .returning('*');
        
        res.json(updatedDepartment[0]);
    } catch (error) {
        res.status(500).json({ error: `Ошибка обновления отделения: ${error.message}` });
    }
});

// DELETE /departments/:id - удаление отделения
router.delete('/departments/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        
        // Проверяем, существует ли отделение
        const existingDepartment = await knex('departments').where('department_id', id).first();
        if (!existingDepartment) {
            return res.status(404).json({ error: 'Отделение не найдено' });
        }
        
        // Проверяем, есть ли в отделении привязанные группы
        const groups = await knex('groups').where('department_id', id);
        if (groups.length > 0) {
            return res.status(400).json({ 
                error: 'Нельзя удалить отделение, так как к нему привязаны группы',
                groupsCount: groups.length,
                groups: groups.map(g => ({ id: g.group_id, name: g.group_name }))
            });
        }
        
        // Удаляем отделение
        const deletedDepartment = await knex('departments')
            .where('department_id', id)
            .del()
            .returning('*');
        
        res.json({ 
            message: 'Отделение успешно удалено',
            deletedDepartment: deletedDepartment[0]
        });
    } catch (error) {
        res.status(500).json({ error: `Ошибка удаления отделения: ${error.message}` });
    }
});

// GET /departments/:id - получение отделения по ID
router.get('/departments/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        
        const department = await knex('departments')
            .select('departments.*', 'users.login', 'users.fio')
            .leftJoin('users', 'departments.user_id', 'users.user_id')
            .where('departments.department_id', id)
            .first();
        
        if (!department) {
            return res.status(404).json({ error: 'Отделение не найдено' });
        }
        
        res.json(department);
    } catch (error) {
        res.status(500).json({ error: `Ошибка получения отделения: ${error.message}` });
    }
});

export default router;