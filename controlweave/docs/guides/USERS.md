# 👥 User Management Guide

Manage team members, roles, and permissions in ControlWeave.

## Overview

ControlWeave supports multiple users per organization with role-based access control (RBAC). Administrators can invite team members, assign roles, and manage permissions from the User Management settings.

## Accessing User Management

Navigate to **Settings** → **Users & Permissions**

## User Roles

| Role | Description | Typical User |
|------|-------------|-------------|
| **Owner** | Full access; billing and org management | Org founder / CTO |
| **Admin** | Full platform access; user management | IT Manager, CISO |
| **Manager** | Read/write compliance data; no admin | Compliance Manager |
| **Analyst** | Read/write assigned areas | Security Analyst |
| **Viewer** | Read-only access | Executives, auditors |
| **Auditor** | Special role for external auditors | External Auditors |

## Inviting a Team Member

1. Go to **Settings** → **Users & Permissions**
2. Click **Invite User**
3. Enter the user's email address
4. Select their role
5. Click **Send Invitation**

The user will receive an email with a link to create their account and join your organization.

## Managing Existing Users

From the Users list, you can:
- **Change Role**: Click the role dropdown next to a user
- **Deactivate**: Temporarily disable access without deleting
- **Remove**: Permanently remove from the organization
- **Resend Invite**: For pending invitations

## Passkey & MFA Requirements

Admins can enforce security requirements:

1. Go to **Settings** → **Security**
2. Enable **Require MFA for All Users**
3. Optionally enable **Require Passkey Authentication**

## Auditor Access

External auditors get a limited-scope login through the Auditor Workspace:

1. Go to **Auditor Workspace** → **Engagements**
2. Open an engagement → **Team** tab
3. Click **Invite Auditor**
4. Auditors only see data relevant to their assigned engagements

## Related Guides

- [Settings & Configuration](SETTINGS.md) - Organization settings
- [Security Settings](SECURITY.md) - Passkeys, SSO, and security features
- [Auditor Workspace](AUDITOR_WORKSPACE.md) - External auditor access
