export type UserRole = 'gestor' | 'republica';

export type AuthUser = {
  sub: string;
  role: UserRole;
  email: string;
  nome: string;
};
