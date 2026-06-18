import NavTabs from "./NavTabs";

export default function AppHeader() {
  return (
    <header className="app-header">
      <span className="brand">
        <span className="mark" aria-hidden />
        Fathom Digest
      </span>
      <NavTabs />
      <a
        className="utility"
        href="https://github.com"
        target="_blank"
        rel="noreferrer noopener"
      >
        Open source · MIT ↗
      </a>
    </header>
  );
}
