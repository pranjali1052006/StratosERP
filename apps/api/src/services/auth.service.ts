import { prisma } from '@stratoserp/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Role, JwtPayload } from '../types';

const ALLOWED_EMAIL_DOMAIN = '@tcetmumbai.in';

function isAllowedDomainEmail(email: string): boolean {
  return email.toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN);
}

export async function loginAdmin(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!isAllowedDomainEmail(normalizedEmail)) return null;

  const admin = await prisma.adminUser.findUnique({
    where: { emailId: normalizedEmail },
  });
  if (!admin) return null;

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) return null;

  const payload: JwtPayload = { id: admin.adminId, role: 'Admin', email: admin.emailId };
  const token = jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  } as jwt.SignOptions);

  return {
    token,
    admin: {
      id: admin.adminId,
      name: admin.name,
      email: admin.emailId,
      role: 'Admin',
    },
  };
}

export async function loginFaculty(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!isAllowedDomainEmail(normalizedEmail)) return null;

  const faculty = await prisma.faculty.findUnique({
    where: { emailId: normalizedEmail },
  });
  if (!faculty) return null;

  const valid = await bcrypt.compare(password, faculty.passwordHash);
  if (!valid) return null;

  // Map designation_role to JWT role
  let role: Role;
  if (faculty.isHod) {
    role = 'HOD';
  } else {
    switch (faculty.designationRole) {
      case 'Class Incharge': role = 'ClassIncharge'; break;
      case 'Subject Incharge': role = 'SubjectIncharge'; break;
      case 'TG': role = 'TG'; break;
      default: role = 'SubjectIncharge';
    }
  }

  const payload: JwtPayload = { id: faculty.facultyId, role, email: faculty.emailId };
  const token = jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  } as jwt.SignOptions);

  return { token, faculty: { id: faculty.facultyId, name: faculty.name, email: faculty.emailId, role } };
}

export async function loginStudent(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!isAllowedDomainEmail(normalizedEmail)) return null;

  const student = await prisma.student.findUnique({
    where: { emailId: normalizedEmail },
  });
  if (!student) return null;

  const valid = await bcrypt.compare(password, student.passwordHash);
  if (!valid) return null;

  const payload: JwtPayload = { id: student.uid, role: 'Student', email: student.emailId };
  const token = jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  } as jwt.SignOptions);

  return {
    token,
    student: { uid: student.uid, email: student.emailId, semester: student.currentSemester, role: 'Student' },
  };
}

export async function changePassword(
  id: number | string,
  role: Role,
  oldPassword: string,
  newPassword: string
): Promise<boolean> {
  let currentHash: string | null = null;

  if (role === 'Student') {
    const student = await prisma.student.findUnique({ where: { uid: String(id) } });
    currentHash = student?.passwordHash ?? null;
  } else if (role === 'Admin') {
    const admin = await prisma.adminUser.findUnique({ where: { adminId: Number(id) } });
    currentHash = admin?.passwordHash ?? null;
  } else {
    const faculty = await prisma.faculty.findUnique({ where: { facultyId: Number(id) } });
    currentHash = faculty?.passwordHash ?? null;
  }

  if (!currentHash) return false;

  const valid = await bcrypt.compare(oldPassword, currentHash);
  if (!valid) return false;

  const hash = await bcrypt.hash(newPassword, 12);

  if (role === 'Student') {
    await prisma.student.update({ where: { uid: String(id) }, data: { passwordHash: hash } });
  } else if (role === 'Admin') {
    await prisma.adminUser.update({ where: { adminId: Number(id) }, data: { passwordHash: hash } });
  } else {
    await prisma.faculty.update({ where: { facultyId: Number(id) }, data: { passwordHash: hash } });
  }

  return true;
}
