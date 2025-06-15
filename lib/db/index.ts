// Database utilities and configurations
export { prisma } from './prisma';

// Database types
import { prisma } from './prisma';
export type DatabaseConnection = typeof prisma;
