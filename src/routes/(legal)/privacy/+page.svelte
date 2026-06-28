<svelte:head>
  <title>Privacy Policy — Cheqii</title>
  <meta name="description" content="How Cheqii collects, uses, and protects your information." />
</svelte:head>

<h1>Privacy Policy</h1>
<p class="updated">Last updated: {`{{EFFECTIVE_DATE}}`}</p>

<p>
  Cheqii (“Cheqii”, “we”, “us”) is operated by {`{{LEGAL_ENTITY}}`}. This policy explains what we
  collect, why, and the choices you have. Questions? Email
  <a href={`mailto:{{CONTACT_EMAIL}}`}>{`{{CONTACT_EMAIL}}`}</a>.
</p>

<h2>Information we collect</h2>
<ul>
  <li>
    <strong>Account information.</strong> If you sign in with Google, we receive your email address,
    name, and profile photo from Google. If you continue as a guest, we create an anonymous account
    identified by a random ID — no email or name is required.
  </li>
  <li>
    <strong>Cheque content.</strong> The cheques you create — their names, line items, amounts, and
    how each item is split — and the names you give the people on a cheque.
  </li>
  <li>
    <strong>Payment details (optional).</strong> If you choose to add a way to be paid back, we store
    the method (e.g. Interac e‑Transfer or PayPal) and the payment ID/handle you enter (such as an
    email address) so others on the cheque can settle up with you.
  </li>
  <li>
    <strong>Technical data.</strong> Our hosting provider (Cloudflare) processes your IP address and
    basic request information to deliver and secure the service, and we use Cloudflare Turnstile to
    deter automated abuse when a guest account is created.
  </li>
</ul>
<p>
  We do <strong>not</strong> use analytics, advertising, or third‑party tracking, and we do not sell
  your personal information.
</p>

<h2>How we use information</h2>
<ul>
  <li>To provide the service — create, share, and sync cheques and compute balances.</li>
  <li>To sign you in and keep you signed in.</li>
  <li>To sync your data across your devices and collaborators in real time.</li>
  <li>To secure the service and prevent abuse.</li>
</ul>

<h2>How information is shared</h2>
<ul>
  <li>
    <strong>With your collaborators.</strong> When you share a cheque (via an invite link), its
    contents — names, items, amounts, and any payment details you added — are visible to everyone who
    joins that cheque.
  </li>
  <li>
    <strong>Service providers.</strong> We rely on Supabase (database, authentication, and real‑time
    sync), Cloudflare (hosting, content delivery, and bot protection), and Google (only if you choose
    to sign in with Google). They process data on our behalf under their own terms.
  </li>
  <li><strong>Legal.</strong> We may disclose information where required by law.</li>
</ul>

<h2>Cookies &amp; local storage</h2>
<p>
  We use a small amount of local storage and a cookie strictly to keep you signed in and remember
  your language. We do not use tracking or advertising cookies, so there is no cookie‑consent
  banner. Your cheques are also cached on your device so the app works offline; clearing your browser
  storage removes that local copy.
</p>

<h2>Data retention &amp; deletion</h2>
<p>
  We keep your data while your account is active. You can remove a cheque (delete it, or leave one
  shared with you) at any time, and you can delete your account, which removes the data associated
  with it. For deletion requests, email <a href={`mailto:{{CONTACT_EMAIL}}`}>{`{{CONTACT_EMAIL}}`}</a>.
</p>

<h2>Your rights</h2>
<p>
  Depending on where you live (for example, PIPEDA in Canada, the GDPR in the EU/UK, or the CCPA in
  California), you may have rights to access, correct, delete, or export your personal information,
  and to withdraw consent. To exercise these, contact
  <a href={`mailto:{{CONTACT_EMAIL}}`}>{`{{CONTACT_EMAIL}}`}</a>.
</p>

<h2>Data location</h2>
<p>
  Our providers (Supabase, Cloudflare, and Google) may process and store information in
  {`{{DATA_REGION}}`}. By using Cheqii, you consent to this processing.
</p>

<h2>Children</h2>
<p>
  Cheqii is not directed to children under {`{{MIN_AGE}}`}, and we do not knowingly collect their
  personal information.
</p>

<h2>Changes to this policy</h2>
<p>We may update this policy from time to time; we will update the “Last updated” date above.</p>

<h2>Contact</h2>
<p>{`{{LEGAL_ENTITY}}`} — <a href={`mailto:{{CONTACT_EMAIL}}`}>{`{{CONTACT_EMAIL}}`}</a></p>

<p><a href="/terms">Terms of Service</a></p>
