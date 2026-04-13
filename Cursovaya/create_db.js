import db from './db.js';

async function createTables() {
  // Users
  await db.schema.createTableIfNotExists('users', table => {
    table.increments('user_id').primary();
    table.string('login').unique();
    table.string('password');
    table.string('fio');
    table.string('role');
  });

  // Departments
  await db.schema.createTableIfNotExists('departments', table => {
    table.increments('department_id').primary();
    table.integer('user_id');
    table.string('department_name').unique();
  });

  // Groups
  await db.schema.createTableIfNotExists('groups', table => {
    table.increments('group_id').primary();
    table.integer('user_id');
    table.string('group_name').unique();
    table.integer('department_id');
  });

  // Students
  await db.schema.createTableIfNotExists('students', table => {
    table.increments('student_id').primary();
    table.integer('group_id');
    table.string('fio');
  });

  // Attendance
  await db.schema.createTableIfNotExists('attendance', table => {
    table.increments('attendance_id').primary();
    table.integer('student_id');
    table.timestamp('entry_time');
    table.timestamp('exit_time');
  });

  console.log('Tables created');

  // --------------------------
  // ТЕСТОВЫЕ ДАННЫЕ
  // --------------------------

  const usersCount = await db('users').count('* as count').first();

  if (usersCount.count == 0) {
    // Пользователи
    const [adminId] = await db('users').insert({
      login: 'admin',
      password: 'admin123',
      fio: 'Администратор',
      role: 'admin'
    });

    const [teacherId] = await db('users').insert({
      login: 'teacher',
      password: 'teacher123',
      fio: 'Иванов Иван Иванович',
      role: 'teacher'
    });

    const [departmentUserId] = await db('users').insert({
      login: 'department',
      password: 'department123',
      fio: 'Кафедра ИТ',
      role: 'department'
    });

    // Кафедра
    const [departmentId] = await db('departments').insert({
      user_id: departmentUserId,
      department_name: 'Информационные технологии'
    });

    // Группа
    const [groupId] = await db('groups').insert({
      user_id: teacherId,
      group_name: 'ИТ-21',
      department_id: departmentId
    });

    // Студенты
    const [student1Id] = await db('students').insert({
      group_id: groupId,
      fio: 'Петров Петр Петрович'
    });

    const [student2Id] = await db('students').insert({
      group_id: groupId,
      fio: 'Сидоров Сидор Сидорович'
    });

    

    console.log('Test data inserted');
  } else {
    console.log('Test data already exists');
  }
}

export default createTables;
