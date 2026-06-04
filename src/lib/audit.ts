import { prisma } from "@/lib/prisma";

export interface AuditLogData {
  action: "CREATE" | "UPDATE" | "DELETE";
  entity: string;
  entityId: string;
  changes?: Record<string, any>;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        changes: data.changes ? JSON.stringify(data.changes) : null,
        userId: data.userId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  } catch (error) {
    console.error("Audit log creation error:", error);
    // Audit log 실패가 주요 기능에 영향을 주지 않도록 에러를 무시
  }
}

export async function getAuditLogs(params: {
  entity?: string;
  entityId?: string;
  action?: string;
  limit?: number;
  offset?: number;
}) {
  const { entity, entityId, action, limit = 50, offset = 0 } = params;

  const where: any = {};
  if (entity) where.entity = entity;
  if (entityId) where.entityId = entityId;
  if (action) where.action = action;

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });

  const total = await prisma.auditLog.count({ where });

  return {
    logs: logs.map((log) => ({
      ...log,
      changes: log.changes ? JSON.parse(log.changes) : null,
    })),
    total,
  };
}
