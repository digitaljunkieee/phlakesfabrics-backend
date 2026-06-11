import bcrypt from 'bcryptjs';
import dbConnect from './mongodb';
import User from '../models/User';

export function getConfiguredAdminEmail() {
  return process.env.ADMIN_EMAIL?.trim().toLowerCase() || '';
}

export async function ensureConfiguredAdminUser(loginEmail?: string) {
  const adminEmail = getConfiguredAdminEmail();
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  const adminName = process.env.ADMIN_NAME?.trim() || 'Phlakes Fabrics Admin';

  if (!adminEmail || !adminPassword) return null;
  if (loginEmail && loginEmail.trim().toLowerCase() !== adminEmail) return null;

  await dbConnect();

  const password = await bcrypt.hash(adminPassword, 10);
  const user = await User.findOneAndUpdate(
    { email: adminEmail },
    {
      $set: {
        name: adminName,
        email: adminEmail,
        password,
        role: 'admin',
      },
    },
    { returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  return user;
}
