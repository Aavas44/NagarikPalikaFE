"use client";

import { useEffect, useState } from "react";
import { fetchCurrentUser, logout } from "@/lib/auth";
import type { AuthUser } from "@/types";
import styles from "@/app/admin.module.css";

export function AdminSidebarFooter() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    fetchCurrentUser().then(setUser);
  }, []);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "SA";

  return (
    <div className={styles.sidebarFooter}>
      <div className={styles.userRow}>
        <div className={styles.avatar}>{initials}</div>
        <div className={styles.userInfo}>
          <p>{user?.name ?? "Super Admin"}</p>
          <span>{user?.email ?? "admin@nagarikpalika.gov.np"}</span>
        </div>
      </div>
      <button type="button" className={styles.logoutBtn} onClick={() => logout()}>
        Sign out
      </button>
    </div>
  );
}
