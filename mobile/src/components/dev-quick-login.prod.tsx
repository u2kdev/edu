import React from "react";

export const DEV_DEMO_PRESETS: Array<{
  key: string;
  roleKey: string;
  email: string;
  subtitle: string;
  color: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: React.ComponentType<any>;
}> = [];

export const DEV_DEFAULT_PASSWORD = "";

export function DevQuickLogin() {
  return null;
}

export function DevRoleSwitcher() {
  return null;
}
