import { SignIn } from "@clerk/nextjs";

import { LoginHero } from "./components/LoginHero";
import {
  BRAND_NAME,
  DASHBOARD_HREF,
  LOGO_LETTER,
  SIGN_IN_APPEARANCE,
} from "./consts";
import {
  BRAND_CLASS_NAME,
  FORM_WRAPPER_CLASS_NAME,
  LOGO_MARK_CLASS_NAME,
  PANEL_CLASS_NAME,
  ROOT_CLASS_NAME,
  WORDMARK_CLASS_NAME,
} from "./styles";

export function Login() {
  return (
    <main className={ROOT_CLASS_NAME}>
      <section className={PANEL_CLASS_NAME}>
        <header className={BRAND_CLASS_NAME}>
          <span className={LOGO_MARK_CLASS_NAME} aria-hidden="true">
            {LOGO_LETTER}
          </span>
          <span className={WORDMARK_CLASS_NAME}>{BRAND_NAME}</span>
        </header>
        <div className={FORM_WRAPPER_CLASS_NAME}>
          <SignIn
            routing="hash"
            fallbackRedirectUrl={DASHBOARD_HREF}
            appearance={SIGN_IN_APPEARANCE}
          />
        </div>
      </section>
      <LoginHero />
    </main>
  );
}
