import { Router } from 'express';
const router = Router();
import Validator from '../utils/validator.js';
import knex from '../db.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';

router.get('/users', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const users = await knex('users').select('*');
        res.status(200).json(users)
    } catch (error) {
        res.status(500).json({error: 'Ошибка получения пользователей'}).status(500);
    }
});

router.post('/users', async (req, res) => {
    try {
        const {login, password, fio, role} = req.body;
        let [surname, name, patronymic] = fio.split(' ');
        if (!Validator.isString(login) || !Validator.isString(password, 8) || !Validator.isString(surname) || !Validator.isString(name) || !Validator.validateRole(role)) {
            throw new Error('Неверные входные данные');
        }
        const user = await knex('users')
            .insert({
                login: login,
                password: password,
                fio: fio,
                role: role
            }).returning('*');
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({error: `Ошибка создания пользователя: ${error.message}`});
    }
});

router.patch('/users/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { login, password, fio, role } = req.body;
        
        // Проверяем, существует ли пользователь
        const existingUser = await knex('users').where('user_id', id).first();
        if (!existingUser) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        // Подготавливаем данные для обновления (только переданные поля)
        const updateData = {};
        
        if (login !== undefined) {
            if (!Validator.isString(login)) {
                throw new Error('Неверный формат login');
            }
            updateData.login = login;
        }
        
        if (password !== undefined) {
            if (!Validator.isString(password, 8)) {
                throw new Error('Пароль должен содержать минимум 8 символов');
            }
            updateData.password = password;
        }
        
        if (fio !== undefined) {
            let [surname, name, patronymic] = fio.split(' ');
            if (!Validator.isString(surname) || !Validator.isString(name)) {
                throw new Error('Неверный формат ФИО');
            }
            updateData.fio = fio;
        }
        
        if (role !== undefined) {
            if (!Validator.validateRole(role)) {
                throw new Error('Неверная роль');
            }
            updateData.role = role;
        }
        
        // Если нет данных для обновления
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'Нет данных для обновления' });
        }
        
        // Обновляем пользователя
        const updatedUser = await knex('users')
            .where('user_id', id)
            .update(updateData)
            .returning('*');
        
        res.status(200).json(updatedUser[0]);
    } catch (error) {
        res.status(500).json({ error: `Ошибка обновления пользователя: ${error.message}` });
    }
});

router.delete('/users/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        
        // Проверяем, существует ли пользователь
        const existingUser = await knex('users').where('user_id', id).first();
        if (!existingUser) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        // Удаляем пользователя
        const deletedUser = await knex('users')
            .where('user_id', id)
            .del()
            .returning('*');
        
        res.status(200).json({ 
            message: 'Пользователь успешно удалён',
            deletedUser: deletedUser[0]
        });
    } catch (error) {
        res.status(500).json({ error: `Ошибка удаления пользователя: ${error.message}` });
    }
});

export default router;

