import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'nila_aquaculture_plts_secret_key_2026';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'operator' | 'viewer';
  createdAt: string;
}

// In-memory persistent user storage with default seeded accounts
const users: UserAccount[] = [
  {
    id: 'usr-admin-1',
    name: 'Administrator Kolam',
    email: 'admin@nila-iot.id',
    passwordHash: bcrypt.hashSync('admin123', 10),
    role: 'admin',
    createdAt: '2026-07-01T00:00:00Z',
  },
  {
    id: 'usr-operator-1',
    name: 'Teknisi & Operator Kolam',
    email: 'operator@nila-iot.id',
    passwordHash: bcrypt.hashSync('operator123', 10),
    role: 'operator',
    createdAt: '2026-07-15T00:00:00Z',
  },
  {
    id: 'usr-guest-1',
    name: 'Tamu / Peneliti Publik',
    email: 'tamu@nila-iot.id',
    passwordHash: bcrypt.hashSync('tamu123', 10),
    role: 'viewer',
    createdAt: '2026-08-01T00:00:00Z',
  }
];

export function authenticateUser(email: string, password: string): { user: Omit<UserAccount, 'passwordHash'>; token: string } | null {
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return null;

  const isValid = bcrypt.compareSync(password, user.passwordHash);
  if (!isValid) return null;

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const { passwordHash, ...userSafe } = user;
  return { user: userSafe, token };
}

export function registerUser(name: string, email: string, password: string, role: 'admin' | 'operator' | 'viewer' = 'operator') {
  const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    throw new Error('Email sudah terdaftar. Silakan gunakan email lain atau login.');
  }

  const newUser: UserAccount = {
    id: `usr-${Date.now()}`,
    name,
    email: email.toLowerCase(),
    passwordHash: bcrypt.hashSync(password, 10),
    role,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);

  const token = jwt.sign(
    { id: newUser.id, email: newUser.email, role: newUser.role, name: newUser.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const { passwordHash, ...userSafe } = newUser;
  return { user: userSafe, token };
}

export function verifyAuthToken(token: string) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = users.find(u => u.id === decoded.id);
    if (!user) return null;
    const { passwordHash, ...userSafe } = user;
    return userSafe;
  } catch (err) {
    return null;
  }
}

export function changeUserPassword(userId: string, oldPass: string, newPass: string) {
  const user = users.find(u => u.id === userId);
  if (!user) throw new Error('Pengguna tidak ditemukan');
  if (!bcrypt.compareSync(oldPass, user.passwordHash)) {
    throw new Error('Password lama salah');
  }
  user.passwordHash = bcrypt.hashSync(newPass, 10);
  return true;
}

export function getAllUsers() {
  return users.map(({ passwordHash, ...u }) => u);
}
