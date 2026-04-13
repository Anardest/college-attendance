import jwt from 'jsonwebtoken';
const { verify } = jwt;
const SECRET = 'SECRET_KEY';

export function authMiddleware(req, res, next) {
  // Получаем токен из заголовка и удаляем "Bearer "
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    console.error('Token verification error:', e.message);
    res.status(401).json({ error: `Invalid token: ${e.message}` });
  }
}

export function roleMiddleware(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
}

export { SECRET };