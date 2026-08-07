export const CONFIRMATION_ACTIONS = [
  'project.archive',
  'project.transfer',
  'project.member.role.update',
  'project.member.remove',
  'organization.archive',
  'organization.transfer',
  'organization.member.role.update',
  'organization.member.remove',
  'release.submit_review',
  'release.withdraw',
  'release.file.delete',
  'admin.account.manage',
  'admin.project.update',
  'admin.organization.update',
  'admin.review.decide',
  'admin.comment.update',
  'admin.file.delete',
  'admin.report.resolve'
] as const;

export const CONFIRMATION_RESOURCE_TYPES = [
  'account',
  'project',
  'organization',
  'release',
  'file',
  'review_task',
  'comment',
  'report'
] as const;

export type ConfirmationAction = (typeof CONFIRMATION_ACTIONS)[number];
export type ConfirmationResourceType = (typeof CONFIRMATION_RESOURCE_TYPES)[number];
export type ConfirmationScope = {
  action: ConfirmationAction;
  resourceType: ConfirmationResourceType;
  resourceId: string;
};

const allowedResourceTypes: Record<ConfirmationAction, readonly ConfirmationResourceType[]> = {
  'project.archive': ['project'],
  'project.transfer': ['project'],
  'project.member.role.update': ['project'],
  'project.member.remove': ['project'],
  'organization.archive': ['organization'],
  'organization.transfer': ['organization'],
  'organization.member.role.update': ['organization'],
  'organization.member.remove': ['organization'],
  'release.submit_review': ['release'],
  'release.withdraw': ['release'],
  'release.file.delete': ['file'],
  'admin.account.manage': ['account'],
  'admin.project.update': ['project'],
  'admin.organization.update': ['organization'],
  'admin.review.decide': ['review_task'],
  'admin.comment.update': ['comment'],
  'admin.file.delete': ['file'],
  'admin.report.resolve': ['report']
};

export function isConfirmationScope(value: { action: ConfirmationAction; resourceType: ConfirmationResourceType }): boolean {
  return allowedResourceTypes[value.action].includes(value.resourceType);
}
