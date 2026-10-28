import type { ActionState } from "@/lib/forms";

export type LoginStep = "email" | "password" | "signup";

export type LoginState = ActionState & {
  step?: LoginStep;
  email?: string;
  needsPasswordSetup?: boolean;
};

export const initialLoginState: LoginState = {};
