import { AuditLog, User, Person } from 'src/generated/prisma/client';
import {
  DashboardActivityItemDto,
  DashboardActivityActionType,
} from '../dto/dashboard-activity.dto';

type AuditLogWithUser = AuditLog & {
  user: (User & { person: Person | null }) | null;
};

export class DashboardActivityMapper {
  static mapToItem(log: AuditLogWithUser): DashboardActivityItemDto {
    const { actionType, title, description } = this.resolveSemanticAction(
      log.entityName,
      log.action,
      log.messageParams as Record<string, any> | null,
    );

    let user: { id: string; displayName: string } | null = null;

    if (log.user) {
      const fullName = log.user.person
        ? `${log.user.person.name || ''} ${log.user.person.lastName || ''}`.trim()
        : '';
      user = {
        id: log.user.id,
        displayName: fullName || log.user.email || 'Usuario',
      };
    }

    return {
      id: log.id,
      actionType,
      rawAction: log.action,
      entityName: log.entityName,
      entityId: log.entityId,
      createdAt: log.createdAt.toISOString(),
      user,
      context: {
        title,
        description,
      },
    };
  }

  private static resolveSemanticAction(
    entityName: string,
    action: string,
    _messageParams: Record<string, any> | null,
  ): { actionType: DashboardActivityActionType; title: string; description?: string } {
    switch (entityName) {
      case 'Payment':
        return {
          actionType: 'PAYMENT',
          title: 'Registro de cobro / pago',
          description: 'Operación procesada en tesorería',
        };

      case 'InternalTransfer':
        return {
          actionType: 'INTERNAL_TRANSFER',
          title: 'Transferencia interna',
          description: 'Movimiento de fondos entre cuentas',
        };

      case 'StudentMembership':
        return {
          actionType: action === 'CREATE' ? 'ENROLLMENT' : 'MEMBERSHIP_STATUS',
          title: action === 'CREATE' ? 'Inscripción escolar' : 'Actualización de membresía escolar',
          description: 'Membresía académica de escuela',
        };

      case 'PlayerMembership':
        return {
          actionType: action === 'CREATE' ? 'ENROLLMENT' : 'MEMBERSHIP_STATUS',
          title: action === 'CREATE' ? 'Inscripción de jugador' : 'Actualización de membresía de club',
          description: 'Membresía deportiva de club',
        };

      case 'CourseSeasonShift':
        return {
          actionType: 'SHIFT_OCCUPANCY',
          title: 'Gestión de turnos',
          description: 'Actualización de cupos u horarios',
        };

      case 'Charge':
      case 'AccountCharge':
      case 'StudentCharge':
      case 'MembershipCharge':
        return {
          actionType: 'PAYMENT',
          title: action === 'CREATE' ? 'Cargo generado' : 'Actualización de cuenta por cobrar',
          description: 'Registro en cartera de cuentas',
        };

      default:
        return {
          actionType: 'SYSTEM',
          title: `Operación sobre ${entityName}`,
          description: `Acción: ${action}`,
        };
    }
  }
}
