import DigestApp from "./DigestApp";

export default function Page() {
  const recipients = (process.env.RECIPIENTS ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);

  return <DigestApp initialRecipients={recipients} />;
}
