export type RoleChangeType =
  | 'promoted'
  | 'demoted'
  | 'suspended'
  | 'banned'
  | 'reactivated'
  | 'changed';

export function determineRoleChangeType(oldRole: string, newRole: string): RoleChangeType {
  const rolePriority: Record<string, number> = {
    banned: 0,
    suspended: 1,
    guest: 2,
    member: 3,
    head: 4,
    admin: 5,
    auditor: 6,
  };

  const oldPriority = rolePriority[oldRole] ?? 3;
  const newPriority = rolePriority[newRole] ?? 3;

  if (newRole === 'banned') return 'banned';
  if (newRole === 'suspended') return 'suspended';

  if ((oldRole === 'banned' || oldRole === 'suspended') && newRole !== 'banned' && newRole !== 'suspended') {
    return 'reactivated';
  }

  if (newPriority > oldPriority) return 'promoted';
  if (newPriority < oldPriority) return 'demoted';

  return 'changed';
}
