const Validator = {
  // Проверяет, что значение определено (не null и не undefined)
  isDefined(value) {
    return value !== null && value !== undefined;
  },

  // Проверяет, что значение — строка (и не пустая, если нужно)
  isString(value, minLength = 0) {
    return typeof value === "string" && value.length >= minLength;
  },

  validateRole(value) {
    const roles = ['admin', 'teacher', 'department'];
    return roles.includes(value);
  },

  // Проверяет, что значение — число (и в нужном диапазоне, если указано)
  isNumber(value, min = -Infinity, max = Infinity) {
    return (
      typeof value === "number" && !isNaN(value) && value >= min && value <= max
    );
  },

  // Проверяет, что значение — целое число
  isInteger(value, min = -Infinity, max = Infinity) {
    return this.isNumber(value, min, max) && Number.isInteger(value);
  },

  // Проверяет, что значение — boolean
  isBoolean(value) {
    return typeof value === "boolean";
  },

  // Проверяет, что значение — массив (и не пустой, если нужно)
  isArray(value, minLength = 0) {
    return Array.isArray(value) && value.length >= minLength;
  },

  // Проверяет, что значение — объект (и не null)
  isObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  },

  /**
   * Проверяет, является ли строка валидной датой.
   * @param {string} value - Строка для проверки.
   * @returns {boolean}
   */
  isDateString(value) {
    if (!this.isString(value)) {
      return false;
    }
    // Пытаемся создать объект Date. isNaN(new Date(value)) вернет true,
    // если строка не может быть разобрана как дата.
    const date = new Date(value);
    return !isNaN(date.getTime());
  },

  // Проверяет ID (число или строка, которую можно привести к числу)
  validateId(value) {
    if (!this.isDefined(value)) {
      throw new Error("ID is required");
    }
    const num = Number(value);
    if (!this.isNumber(num) || !this.isInteger(num, 1)) {
      throw new Error("ID must be a positive integer");
    }
    return num;
  },
  /**
   * Проверяет, что значение — массив валидных ID.
   * Каждый элемент массива проходит через validateId.
   * @param {any} value - Значение для проверки.
   * @param {number} [minLength=0] - Минимальная длина массива.
   * @returns {number[]} Массив числовых ID.
   * @throws {Error} Если массив пустой, не массив или содержит невалидные ID.
   */
  validateIdArray(value, minLength = 0) {
    if (!this.isArray(value, minLength)) {
      throw new Error(`Array of IDs is required (min length: ${minLength})`);
    }

    const ids = [];
    for (let i = 0; i < value.length; i++) {
      try {
        const id = this.validateId(value[i]);
        ids.push(id);
      } catch (error) {
        throw new Error(`Invalid ID at index ${i}: ${error.message}`);
      }
    }

    return ids;
  },
};

export default Validator;
