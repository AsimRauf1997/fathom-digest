import NavTabs from "./NavTabs";
import { LogoutButton } from "@/components/auth/logout-button";

export default function AppHeader() {
  return (
    <header className="app-header">
      <span className="brand">
        <span className="mark" aria-hidden />
        Fathom Digest
      </span>
      <NavTabs />
      <div className="header-actions">
        <a
          className="utility"
          href="https://github.com"
          target="_blank"
          rel="noreferrer noopener"
        >
          Open source · MIT ↗
        </a>
        <LogoutButton />
      </div>
    </header>
  );
}
