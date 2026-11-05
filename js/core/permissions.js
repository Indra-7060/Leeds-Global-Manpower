/* PERMISSIONS — DEMONSTRATION ONLY. The role is a dropdown, exactly as in V6; it is NOT authentication.
   Real access control must be enforced server-side (docs/06). */
(function (g) {
  'use strict';
  const LGM = (g.LGM = g.LGM || {});
  LGM.Permissions = {
    can(role, perm) { const allowed = LGM.Config.permissions[perm]; return !!allowed && allowed.includes(role); },
    roleLabel(role) { return (LGM.Config.roles.find(r => r.id === role) || {}).label || role; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
