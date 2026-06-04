/**
 * user_clients 테이블 관련 타입
 * DB CHECK 제약: role IN ('member', 'admin')
 */
export type UserClientRole = "member" | "admin";

export interface UserClientRow {
  id: string;
  user_id: string;
  client_id: string;
  role: UserClientRole;
  created_at?: string;
  updated_at?: string;
}
