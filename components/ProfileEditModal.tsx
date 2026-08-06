'use client';

import { ImagePlus, Save, Trash2, Upload, UserPlus, X } from 'lucide-react';
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react';

export type ProfileMemberRole = 'owner' | 'admin' | 'maintainer' | 'member' | 'viewer';

export type ProfileMember = {
  id: string;
  name: string;
  role: ProfileMemberRole;
  avatarUrl?: string;
};

export type ProfileEditValues = {
  name: string;
  avatarUrl?: string;
  description: string;
  members: ProfileMember[];
};

type ProfileEditModalProps = {
  kind: 'user' | 'organization';
  initialName: string;
  initialAvatarUrl?: string;
  initialDescription: string;
  initialMembers: ProfileMember[];
  canManageMembers: boolean;
  english: boolean;
  onClose: () => void;
  onSave: (values: ProfileEditValues) => void;
};

const roleLabels = {
  owner: { zh: '所有者', en: 'Owner' },
  admin: { zh: '管理员', en: 'Admin' },
  maintainer: { zh: '维护者', en: 'Maintainer' },
  member: { zh: '成员', en: 'Member' },
  viewer: { zh: '只读成员', en: 'Viewer' }
} as const;

const copy = {
  zh: {
    userTitle: '编辑个人资料',
    organizationTitle: '编辑组织资料',
    close: '关闭编辑窗口',
    name: '名称',
    namePlaceholder: '输入名称',
    description: '介绍',
    descriptionPlaceholder: '介绍你自己或这个组织。',
    avatar: '头像',
    uploadAvatar: '上传图片',
    removeAvatar: '移除图片',
    members: '组织成员',
    memberName: '用户名或账号标识',
    memberNamePlaceholder: '例如：mira',
    memberRole: '角色',
    addMember: '添加成员',
    removeMember: '移除成员',
    cancel: '取消',
    save: '保存资料',
    ownerHint: '只有组织所有者可以添加、移除成员和调整角色。',
    imageTooLarge: '图片不能超过 5 MB。',
    nameRequired: '请输入名称。',
    memberRequired: '请输入成员账号。',
    memberExists: '该成员已经在组织中。'
  },
  en: {
    userTitle: 'Edit profile',
    organizationTitle: 'Edit organization',
    close: 'Close profile editor',
    name: 'Name',
    namePlaceholder: 'Enter a name',
    description: 'Description',
    descriptionPlaceholder: 'Introduce yourself or this organization.',
    avatar: 'Avatar',
    uploadAvatar: 'Upload image',
    removeAvatar: 'Remove image',
    members: 'Organization members',
    memberName: 'Username or account ID',
    memberNamePlaceholder: 'For example: mira',
    memberRole: 'Role',
    addMember: 'Add member',
    removeMember: 'Remove member',
    cancel: 'Cancel',
    save: 'Save profile',
    ownerHint: 'Only the organization owner can add, remove, or change member roles.',
    imageTooLarge: 'Images must be 5 MB or smaller.',
    nameRequired: 'Enter a name.',
    memberRequired: 'Enter a member account.',
    memberExists: 'This member is already in the organization.'
  }
} as const;

export function ProfileEditModal({
  kind,
  initialName,
  initialAvatarUrl,
  initialDescription,
  initialMembers,
  canManageMembers,
  english,
  onClose,
  onSave
}: ProfileEditModalProps) {
  const text = english ? copy.en : copy.zh;
  const [name, setName] = useState(initialName);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [description, setDescription] = useState(initialDescription);
  const [members, setMembers] = useState(initialMembers);
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState<ProfileMemberRole>('member');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError(text.imageTooLarge);
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
        setError('');
      }
    };
    reader.readAsDataURL(file);
  }

  function removeAvatar() {
    setAvatarUrl(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function addMember() {
    const cleanName = memberName.trim();
    if (!cleanName) {
      setError(text.memberRequired);
      return;
    }
    const memberId = cleanName.toLocaleLowerCase().replace(/\s+/g, '-');
    if (members.some((member) => member.id.toLocaleLowerCase() === memberId)) {
      setError(text.memberExists);
      return;
    }
    setMembers((current) => [...current, { id: memberId, name: cleanName, role: memberRole }]);
    setMemberName('');
    setError('');
  }

  function updateMemberRole(memberId: string, role: ProfileMemberRole) {
    setMembers((current) => current.map((member) => member.id === memberId ? { ...member, role } : member));
  }

  function removeMember(memberId: string) {
    setMembers((current) => current.filter((member) => member.id !== memberId));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError(text.nameRequired);
      return;
    }
    onSave({ name: cleanName, avatarUrl, description: description.trim(), members });
  }

  return (
    <div className="auth-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="auth-modal profile-edit-modal" role="dialog" aria-modal="true" aria-labelledby="profile-edit-title">
        <button className="auth-modal__close" type="button" aria-label={text.close} onClick={onClose}>
          <X size={19} strokeWidth={1.8} aria-hidden="true" />
        </button>

        <div className="auth-modal__heading profile-edit-modal__heading">
          <span className="auth-modal__eyebrow">{kind === 'organization' ? text.members : text.avatar}</span>
          <h2 id="profile-edit-title">{kind === 'organization' ? text.organizationTitle : text.userTitle}</h2>
        </div>

        <form className="auth-form profile-edit-form" onSubmit={submit}>
          <div className="profile-edit-avatar-field">
            <span className="auth-field__label">{text.avatar}</span>
            <div className="profile-edit-avatar">
              <span className="profile-edit-avatar__preview">
                {avatarUrl ? <img src={avatarUrl} alt="" /> : <ImagePlus size={26} strokeWidth={1.7} aria-hidden="true" />}
              </span>
              <div className="profile-edit-avatar__actions">
                <label className="auth-code-button profile-edit-upload">
                  <Upload size={16} strokeWidth={1.9} aria-hidden="true" />
                  <span>{text.uploadAvatar}</span>
                  <input ref={fileInputRef} className="profile-edit-file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarChange} />
                </label>
                {avatarUrl ? <button className="profile-edit-remove" type="button" onClick={removeAvatar}><Trash2 size={16} strokeWidth={1.9} aria-hidden="true" /><span>{text.removeAvatar}</span></button> : null}
              </div>
            </div>
          </div>

          <label className="auth-field">
            <span>{text.name}</span>
            <span className="auth-input-wrap"><input value={name} onChange={(event) => setName(event.target.value)} placeholder={text.namePlaceholder} maxLength={80} required /></span>
          </label>

          <label className="auth-field">
            <span>{text.description}</span>
            <span className="auth-input-wrap profile-edit-textarea-wrap"><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder={text.descriptionPlaceholder} maxLength={280} rows={5} /></span>
          </label>

          {kind === 'organization' && canManageMembers ? (
            <fieldset className="profile-edit-members">
              <legend>{text.members}</legend>
              <p className="profile-edit-hint">{text.ownerHint}</p>
              <div className="profile-edit-member-list">
                {members.map((member) => (
                  <div className="profile-edit-member" key={member.id}>
                    <span className="profile-edit-member__identity"><span className="profile-edit-member__avatar">{member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : member.name.slice(0, 1).toUpperCase()}</span><span><strong>{member.name}</strong><small>{member.id}</small></span></span>
                    <span className="profile-edit-member__controls">
                      <select value={member.role} aria-label={`${text.memberRole}: ${member.name}`} onChange={(event) => updateMemberRole(member.id, event.target.value as ProfileMemberRole)}>
                        {(Object.keys(roleLabels) as ProfileMemberRole[]).map((role) => <option key={role} value={role}>{english ? roleLabels[role].en : roleLabels[role].zh}</option>)}
                      </select>
                      {member.role !== 'owner' ? <button className="profile-edit-member__remove" type="button" title={text.removeMember} aria-label={`${text.removeMember}: ${member.name}`} onClick={() => removeMember(member.id)}><Trash2 size={16} strokeWidth={1.9} aria-hidden="true" /></button> : null}
                    </span>
                  </div>
                ))}
              </div>
              <div className="profile-edit-add-member">
                <input value={memberName} onChange={(event) => setMemberName(event.target.value)} placeholder={text.memberNamePlaceholder} aria-label={text.memberName} />
                <select value={memberRole} aria-label={text.memberRole} onChange={(event) => setMemberRole(event.target.value as ProfileMemberRole)}>
                  {(Object.keys(roleLabels) as ProfileMemberRole[]).filter((role) => role !== 'owner').map((role) => <option key={role} value={role}>{english ? roleLabels[role].en : roleLabels[role].zh}</option>)}
                </select>
                <button className="auth-code-button profile-edit-add-button" type="button" onClick={addMember}><UserPlus size={16} strokeWidth={1.9} aria-hidden="true" /><span>{text.addMember}</span></button>
              </div>
            </fieldset>
          ) : null}

          {error ? <p className="auth-form__error" role="alert">{error}</p> : null}
          <div className="profile-edit-form__actions">
            <button className="auth-code-button" type="button" onClick={onClose}>{text.cancel}</button>
            <button className="auth-modal__primary" type="submit"><Save size={17} strokeWidth={1.9} aria-hidden="true" /><span>{text.save}</span></button>
          </div>
        </form>
      </section>
    </div>
  );
}
