export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'IBM Plex Sans, sans-serif' }}>
      <h1>Agent Studio Embed Runtime</h1>
      <p>
        Open <code>/embed/&lt;orgSlug&gt;/&lt;appSlug&gt;?token=pub_…</code> inside an iframe after
        publishing the application on the <strong>embed</strong> channel.
      </p>
    </main>
  );
}
