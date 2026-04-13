import { Router } from "express";
const router = Router();
import Validator from "../utils/validator.js";
import knex from "../db.js";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import ExcelJS from "exceljs";

function buildStats(knexQuery) {
    return knexQuery.count("* as total").select(
        knex.raw(`
                SUM(CASE WHEN entry_time::time > '08:00' THEN 1 ELSE 0 END) AS late_count
            `),
        knex.raw(`
                SUM(CASE WHEN exit_time::time < '14:00' THEN 1 ELSE 0 END) AS early_exit_count
            `),
        knex.raw(`
                AVG(entry_time::time) AS avg_entry_time
            `),
        knex.raw(`
                AVG(exit_time::time) AS avg_exit_time
            `),
    );
}

router.get(
    "/reports/department/:id",
    authMiddleware,
    roleMiddleware(["admin"]),
    async (req, res) => {
        try {
            const { id } = req.params;

            const stats = await buildStats(
                knex("attendance")
                    .join("students", "attendance.student_id", "students.student_id")
                    .join("groups", "students.group_id", "groups.group_id")
                    .where("groups.department_id", id),
            ).first();

            res.json(stats);
        } catch (error) {
            res
                .status(500)
                .json({ error: `Ошибка отчёта по отделению: ${error.message}` });
        }
    },
);

router.get(
    "/reports/group/:id",
    authMiddleware,
    roleMiddleware(["admin"]),
    async (req, res) => {
        try {
            const { id } = req.params;

            const stats = await buildStats(
                knex("attendance")
                    .join("students", "attendance.student_id", "students.student_id")
                    .where("students.group_id", id),
            ).first();

            res.json(stats);
        } catch (error) {
            res
                .status(500)
                .json({ error: `Ошибка отчёта по группе: ${error.message}` });
        }
    },
);

router.get(
    "/reports/student/:id",
    authMiddleware,
    roleMiddleware(["admin"]),
    async (req, res) => {
        try {
            const { id } = req.params;
            const stats = await buildStats(
                knex("attendance").where("student_id", id),
            ).first();
            res.json(stats);
        } catch (error) {
            res
                .status(500)
                .json({ error: `Ошибка отчёта по студенту: ${error.message}` });
        }
    },
);

async function getTeacherGroupId(userId) {
    const user = await knex("users")
        .join("groups", "groups.user_id", "users.id")
        .where("users.id", userId)
        .first();

    return user?.group_id || null;
}

async function getDepartmentId(userId) {
    const user = await knex("users").where("id", userId).first();

    return user?.department_id || null;
}

router.get("/reports/me", authMiddleware, async (req, res) => {
    try {
        const user = req.user;

        let query;

        // 👨‍🏫 TEACHER
        if (user.role === "teacher") {
            const group = await knex("groups")
                .where("user_id", user.user_id)
                .first();

            if (!group) {
                return res.status(403).json({ error: "Группа не назначена" });
            }

            // 🔹 Общая статистика
            const baseQuery = knex("attendance")
                .join("students", "attendance.student_id", "students.student_id")
                .where("students.group_id", group.group_id);

            const stats = await buildStats(baseQuery.clone()).first();

            // 🔹 Статистика по студентам
            const students = await knex("attendance")
                .join("students", "attendance.student_id", "students.student_id")
                .where("students.group_id", group.group_id)
                .groupBy("students.student_id", "students.fio")
                .select("students.student_id", "students.fio")
                .count("* as total")
                .select(
                    knex.raw(`SUM(CASE WHEN entry_time::time > '08:00' THEN 1 ELSE 0 END) AS late_count`),
                    knex.raw(`SUM(CASE WHEN exit_time::time < '16:00' THEN 1 ELSE 0 END) AS early_exit_count`),
                    knex.raw(`AVG(entry_time::time) AS avg_entry_time`),
                    knex.raw(`AVG(exit_time::time) AS avg_exit_time`)
                );

            res.json({
                stats,
                students
            });
        }

        // 🏢 DEPARTMENT
        else if (user.role === "department") {
            const department = await knex("departments")
                .where("user_id", user.user_id)
                .first();

            if (!department) {
                return res.status(403).json({ error: "Отделение не назначено" });
            }

            query = knex("attendance")
                .join("students", "attendance.student_id", "students.student_id")
                .join("groups", "students.group_id", "groups.group_id")
                .where("groups.department_id", department.department_id);

            const groupStats = await knex("attendance")
                .join("students", "attendance.student_id", "students.student_id")
                .join("groups", "students.group_id", "groups.group_id")
                .where("groups.department_id", department.department_id)
                .groupBy("groups.group_id", "groups.group_name")
                .select("groups.group_id", "groups.group_name")
                .count("* as total")
                .select(
                    knex.raw(
                        `SUM(CASE WHEN entry_time::time > '08:00' THEN 1 ELSE 0 END) AS late_count`,
                    ),
                    knex.raw(
                        `SUM(CASE WHEN exit_time::time < '16:00' THEN 1 ELSE 0 END) AS early_exit_count`,
                    ),
                );

            const stats = await buildStats(query).first();

            res.json({
                stats,
                groups: groupStats,
            });
        }

        // 👑 ADMIN
        else if (user.role === "admin") {
            query = knex("attendance");
            const stats = await buildStats(query).first();

            res.json(stats);
        } else {
            return res.status(403).json({ error: "Нет доступа" });
        }
        res.json();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get("/reports/me/export/teacher", authMiddleware, roleMiddleware(["teacher"]), async (req, res) => {
    try {
        const user = req.user;

        const group = await knex("groups")
            .where("user_id", user.user_id)
            .first();

        if (!group) {
            return res.status(403).json({ error: "Группа не назначена" });
        }

        // Получаем студентов + статистику
        const students = await knex("attendance")
            .join("students", "attendance.student_id", "students.student_id")
            .where("students.group_id", group.group_id)
            .groupBy("students.student_id", "students.fio")
            .select("students.fio")
            .count("* as total")
            .select(
                knex.raw(`SUM(CASE WHEN entry_time::time > '08:00' THEN 1 ELSE 0 END) AS late_count`),
                knex.raw(`SUM(CASE WHEN exit_time::time < '14:00' THEN 1 ELSE 0 END) AS early_exit_count`),
                knex.raw(`AVG(entry_time::time) AS avg_entry_time`),
                knex.raw(`AVG(exit_time::time) AS avg_exit_time`)
            );

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Отчёт");

        // Заголовки
        sheet.columns = [
            { header: "ФИО", key: "fio", width: 30 },
            { header: "Всего", key: "total", width: 10 },
            { header: "Опоздания", key: "late", width: 15 },
            { header: "Ранний уход", key: "early", width: 15 },
            { header: "Средний приход", key: "entry", width: 20 },
            { header: "Средний уход", key: "exit", width: 20 },
        ];

        // helper форматирования времени
        function formatTime(t) {
            if (!t) return "";
            if (typeof t === "string") return t;

            const h = String(t.hours ?? 0).padStart(2, "0");
            const m = String(t.minutes ?? 0).padStart(2, "0");
            const s = String(Math.floor(t.seconds ?? 0)).padStart(2, "0");

            return `${h}:${m}:${s}`;
        }

        students.forEach(s => {
            sheet.addRow({
                fio: s.fio,
                total: s.total,
                late: s.late_count,
                early: s.early_exit_count,
                entry: formatTime(s.avg_entry_time),
                exit: formatTime(s.avg_exit_time)
            });
        });

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=report.xlsx"
        );

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get(
  "/reports/me/export/department",
  authMiddleware,
  roleMiddleware(["department"]),
  async (req, res) => {
    try {
      const user = req.user;

      // 🔹 Находим отделение пользователя
      const department = await knex("departments")
        .where("user_id", user.user_id)
        .first();

      if (!department) {
        return res.status(403).json({ error: "Отделение не назначено" });
      }

      // 🔹 Получаем статистику по группам
      const groups = await knex("attendance")
        .join("students", "attendance.student_id", "students.student_id")
        .join("groups", "students.group_id", "groups.group_id")
        .where("groups.department_id", department.department_id)
        .groupBy("groups.group_id", "groups.group_name")
        .select("groups.group_name")
        .count("* as total")
        .select(
          knex.raw(`
            SUM(CASE WHEN entry_time::time > '08:00' THEN 1 ELSE 0 END) AS late_count
          `),
          knex.raw(`
            SUM(CASE WHEN exit_time::time < '14:00' THEN 1 ELSE 0 END) AS early_exit_count
          `),
          knex.raw(`
            AVG(entry_time::time) AS avg_entry_time
          `),
          knex.raw(`
            AVG(exit_time::time) AS avg_exit_time
          `)
        );

      // 🔹 Excel
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Отчёт по группам");

      sheet.columns = [
        { header: "Группа", key: "group", width: 25 },
        { header: "Всего записей", key: "total", width: 15 },
        { header: "Опоздания", key: "late", width: 15 },
        { header: "Ранний уход", key: "early", width: 15 },
        { header: "Средний приход", key: "entry", width: 20 },
        { header: "Средний уход", key: "exit", width: 20 },
      ];

      function formatTime(t) {
        if (!t) return "";
        if (typeof t === "string") return t;

        const h = String(t.hours ?? 0).padStart(2, "0");
        const m = String(t.minutes ?? 0).padStart(2, "0");
        const s = String(Math.floor(t.seconds ?? 0)).padStart(2, "0");

        return `${h}:${m}:${s}`;
      }

      groups.forEach((g) => {
        sheet.addRow({
          group: g.group_name,
          total: g.total,
          late: g.late_count,
          early: g.early_exit_count,
          entry: formatTime(g.avg_entry_time),
          exit: formatTime(g.avg_exit_time),
        });
      });

      // 🔹 Заголовки ответа
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=department_report.xlsx"
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
