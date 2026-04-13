import { Router } from 'express';
const router = Router();
import Validator from '../utils/validator.js';
import knex from '../db.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';

// 🔹 1. Получить последние 20 записей
router.get('/attendance', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const records = await knex('attendance')
            .select(
                'attendance.*',
                'students.fio',
                'groups.group_name'
            )
            .leftJoin('students', 'attendance.student_id', 'students.student_id')
            .leftJoin('groups', 'students.group_id', 'groups.group_id')
            .orderBy('entry_time', 'desc')
            .limit(20);

        res.json(records);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка получения посещаемости' });
    }
});


// 🔹 2. Генерация 20 случайных записей
router.post('/attendance/generate', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        // Получаем всех студентов
        const students = await knex('students').select('student_id');

        if (students.length === 0) {
            return res.status(400).json({ error: 'Нет студентов в базе' });
        }

        const records = [];

        for (let i = 0; i < 20; i++) {
            const randomStudent = students[Math.floor(Math.random() * students.length)];

            // случайное время входа (сегодня)
            const now = new Date();
            const entry = new Date(now);
            entry.setHours(7 + Math.floor(Math.random() * 2)); // 7-10
            entry.setMinutes(Math.floor(Math.random() * 60));

            // выход через 6-7 часа
            const exit = new Date(entry);
            exit.setHours(entry.getHours() + 6 + Math.floor(Math.random() * 4));

            records.push({
                student_id: randomStudent.student_id,
                entry_time: entry,
                exit_time: exit
            });
        }

        const inserted = await knex('attendance')
            .insert(records)
            .returning('*');

        res.json({
            message: 'Сгенерировано 20 записей',
            data: inserted
        });

    } catch (error) {
        res.status(500).json({ error: `Ошибка генерации: ${error.message}` });
    }
});

export default router;