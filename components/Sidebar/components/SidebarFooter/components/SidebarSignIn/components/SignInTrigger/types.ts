export interface SignInTriggerProps {
  isCollapsed: boolean;
  // Injected by Clerk's SignInButton, which wraps this component.
  onClick?: () => void;
}
