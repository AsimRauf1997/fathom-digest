export default function AppFooter({ date }: { date: string }) {
  return (
    <footer className="site-footer">
      <span>Fathom Digest · {date}</span>
      <div className="links">
        <a href="https://github.com" target="_blank" rel="noreferrer noopener">
          GitHub
        </a>
        <a href="https://fathom.video" target="_blank" rel="noreferrer noopener">
          Powered by Fathom
        </a>
        <span className="muted">MIT License</span>
      </div>
    </footer>
  );
}
