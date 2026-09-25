import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'pick-any-long-random-string-here';

export interface AuthenticatedDeviceRequest extends Request {
  device?: {
    sub: string;
    role: string;
    vehicleId: string;
  };
}

export const requireDevice = (
  req: AuthenticatedDeviceRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];
  
  // Explicitly check for token to satisfy TypeScript's strict null checks
  if (!token) {
    res.status(401).json({ error: 'Token missing from header' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;

    if (payload.role !== 'DEVICE' || !payload.vehicleId) {
      res.status(403).json({ error: 'Device access required' });
      return;
    }

    req.device = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};