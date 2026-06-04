import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const DATABASE_PATH = path.join(process.cwd(), 'prisma', 'dev.db');

export interface BackupInfo {
  filename: string;
  path: string;
  size: number;
  createdAt: Date;
}

export async function ensureBackupDir(): Promise<void> {
  try {
    await fs.access(BACKUP_DIR);
  } catch {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
  }
}

export async function createBackup(): Promise<string> {
  await ensureBackupDir();
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${timestamp}.db`;
  const backupPath = path.join(BACKUP_DIR, filename);
  
  // SQLite 데이터베이스 복사
  await fs.copyFile(DATABASE_PATH, backupPath);
  
  return filename;
}

export async function listBackups(): Promise<BackupInfo[]> {
  await ensureBackupDir();
  
  const files = await fs.readdir(BACKUP_DIR);
  const backups: BackupInfo[] = [];
  
  for (const file of files) {
    if (file.startsWith('backup-') && file.endsWith('.db')) {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = await fs.stat(filePath);
      const timestamp = file.replace('backup-', '').replace('.db', '');
      
      backups.push({
        filename: file,
        path: filePath,
        size: stats.size,
        createdAt: new Date(timestamp),
      });
    }
  }
  
  return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function restoreBackup(filename: string): Promise<void> {
  await ensureBackupDir();
  
  const backupPath = path.join(BACKUP_DIR, filename);
  
  // 백업 파일 존재 확인
  await fs.access(backupPath);
  
  // 현재 데이터베이스 백업 (안전장치)
  const safetyBackup = await createBackup();
  console.log(`Safety backup created: ${safetyBackup}`);
  
  // 데이터베이스 복구
  await fs.copyFile(backupPath, DATABASE_PATH);
  
  console.log(`Database restored from ${filename}`);
}

export async function deleteBackup(filename: string): Promise<void> {
  await ensureBackupDir();
  
  const backupPath = path.join(BACKUP_DIR, filename);
  await fs.unlink(backupPath);
  
  console.log(`Backup deleted: ${filename}`);
}

export async function getBackupStats(): Promise<{
  totalBackups: number;
  totalSize: number;
  oldestBackup: Date | null;
  newestBackup: Date | null;
}> {
  const backups = await listBackups();
  
  if (backups.length === 0) {
    return {
      totalBackups: 0,
      totalSize: 0,
      oldestBackup: null,
      newestBackup: null,
    };
  }
  
  const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
  
  return {
    totalBackups: backups.length,
    totalSize,
    oldestBackup: backups[backups.length - 1].createdAt,
    newestBackup: backups[0].createdAt,
  };
}

export async function cleanupOldBackups(keepCount: number = 10): Promise<string[]> {
  const backups = await listBackups();
  const deleted: string[] = [];
  
  if (backups.length > keepCount) {
    const toDelete = backups.slice(keepCount);
    
    for (const backup of toDelete) {
      await deleteBackup(backup.filename);
      deleted.push(backup.filename);
    }
  }
  
  return deleted;
}
